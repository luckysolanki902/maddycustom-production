'use client';

import React from 'react';
import Image from 'next/image';
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

  return (
    <div className={styles.sliderContainer}>
      {images.map((src, idx) => (
        <div className={styles.imageWrapper} key={idx}>
          <Image
            src={src}
            alt={`product-${idx}`}
            width={200}              /* this sets the height via style */
            height={200}
            style={{ width: 'auto', height: '200px', display: 'block' }}
            unoptimized
            priority={idx === 0}
          />
        </div>
      ))}
    </div>
  );
}
