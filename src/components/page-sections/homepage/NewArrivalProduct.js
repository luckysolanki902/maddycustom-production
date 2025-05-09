// components/NewArrivalProduct.js
"use client";

import React from "react";
import Image from "next/image";
import { useMediaQuery } from "@mui/material";
import styles from "./styles/NewArrivalProduct.module.css";

const imageUrls = [
  { image: "/assets/posters/keychain1.png" },
  { image: "/assets/category-cards/win_wrap_category.jpg" },
  { image: "/assets/icons/half_helmet.png" },
  { image: "/assets/homepage/4.png" },
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
        {imageUrls.map((src, idx) => (
          <div key={idx} className={styles.card}>
            <div className={styles.imageContainer}>
              <Image
                src={src.image}
                alt={`New arrival ${idx + 1}`}
                layout="fill"
                objectFit="cover"
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

