'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import styles from './styles/ProductImageSlider.module.css';

export default function ProductImageSlider() {
  // your CloudFront base URL
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL.replace(/\/$/, '');

  // hard-coded list of image paths on AWS
  const imageKeys = [
    '/assets/posters/1product-image-h.jpg',
    '/assets/posters/1product-image-v.jpg',
    '/assets/posters/2product-image-h.jpg',
    '/assets/posters/2product-image-v.jpg',
    '/assets/posters/3product-image-h.jpg',
    '/assets/posters/3product-image-v.jpg',
    '/assets/posters/4product-image-h.jpg',
    '/assets/posters/4product-image-v.jpg',
    '/assets/posters/5product-image-v.jpg',
    '/assets/posters/6product-image-v.jpg',
    '/assets/posters/7product-image-v.jpg',
    '/assets/posters/8product-image-v.jpg',
  ];

  // build full URLs
  const images = imageKeys.map(key => `${baseUrl}${key}`);

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
            style={{ width: 'auto', height: '200px', display: 'block' }}
            unoptimized
            priority={idx === 0}
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
