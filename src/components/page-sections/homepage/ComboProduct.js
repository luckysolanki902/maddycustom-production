"use client";

import React from 'react';
import Link from 'next/link'; 
import Image from 'next/image';
import { useMediaQuery } from '@mui/material';
import styles from './styles/ComboProduct.module.css';
// import Link from 'next/link';
export default function ComboProduct({
  smallPosters = [],    // optional array of full AWS URLs
  largePoster = '',     // optional single AWS URL
    smallLinks=[
    '/combos/dual-style-car-wraps',
    '/combos/mini-custom-wraps',
  ],
  largeLink="/combos/ultimate-car-wraps"
}) {
  // ensure breakpoints for responsive grid if needed
  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  
  // define your Cloudfront base URL
  const base = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // fallback defaults if props aren’t provided
  const small = smallPosters.length === 3
    ? smallPosters
    : isSmallScreen
      ? [
          `${base}/assets/posters/1mobile_combo-offer.png`,   
          `${base}/assets/posters/1mobile_combo-offer.png`,  
        ]
      : [
          `${base}/assets/posters/1desktop_combo-offer.png`,   
          `${base}/assets/posters/2desktop_combo-offer.png`,  
        ];

  const large = largePoster || (isSmallScreen
    ? `${base}/assets/posters/3mobile for ₹ 1298_combo-offer.png`
    : `${base}/assets/posters/3desktop for ₹ 1298_combo-offer.png`);
   
  return (
    <div className={styles.container}>
      {/* Top row: three small posters */}
      <div className={styles.smallContainer}>
        {small.map((src, idx) => (
          <Link href={smallLinks[idx]?? '#'} key={idx} className={styles.small}>
            <Image
              src={src}
              alt={`promo-${idx}`}
              width={500}
              height={300}
              style={{ width: '100%', height: 'auto', display: 'block' ,cursor:'pointer'}}
              priority
            />
          </Link>
        ))}
      </div>

      {/* Bottom row: one large poster spanning all columns */}
       <div className={styles.largeContainer}>
        <Link href={largeLink} className={styles.large}>
          <Image
            src={large}
            alt="promo-large"
            width={1172}
            height={265}
            style={{ width: '100%', height: 'auto', display: 'block', cursor:'pointer' }}
            priority
          />
          </Link>
        </div>
      </div>
  );
}


