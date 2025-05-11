// components/NewArrivalProduct.js
"use client";

import React from "react";
import Image from "next/image";
import { useMediaQuery } from "@mui/material";
import styles from "./styles/NewArrivalProduct.module.css";

const rawBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || '';
// ensure no trailing slash
const baseImageUrl = rawBaseUrl.replace(/\/$/, '');
const imagePaths = [
  '/assets/posters/1newarrival.png',
  '/assets/posters/2newarrival.png',
  '/assets/posters/3newarrival.png',
  '/assets/posters/4newarrival.png',
];

export default function NewArrivalProduct() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>New Arrivals</h2>

      <div
        className={
          isMobile
            ? `${styles.cardWrapper} ${styles.mobile}`
            : `${styles.cardWrapper} ${styles.desktop}`
        }
      >
          {imagePaths.map((path, idx) => (
          <div key={idx} className={styles.card}>
            <div className={styles.imageContainer}>
              <Image
                src={`${baseImageUrl}${path}`}
                alt={`New arrival ${idx + 1}`}
                fill
                style={{ objectFit: 'cover' }}
                className={styles.cardImg}
                unoptimized
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

