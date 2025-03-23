"use client";

import React from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import { useMediaQuery } from "@mui/material";
import styles from "./styles/ProductCategoryBox.module.css";

const ProductCategoryBox = ({ position = "default" }) => {
  // Use 1000px as the breakpoint.
  const isMobile = useMediaQuery("(max-width: 1000px)");

  // If position is "aboveHero" and screen is 1000px or below, hide this instance.
  if (position === "aboveHero" && isMobile) return null;
  // If position is "belowHero" and screen is above 1000px, hide this instance.
  if (position === "belowHero" && !isMobile) return null;

  const cardData = [
    { name: "Wraps", link: "/shop/wraps/car-wraps/window-pillar-wraps/win-wraps" },
    { name: "Key Chains", link: "/shop/accessories/minimal-personalization/keychains/realistic-functional-keychains" },
    { name: "Air Freshener", link: "/shop/accessories/car-care/car-air-freshners/hanging-bottle-car-fresheners" },
    { name: "Tank Wraps", link: "/shop/wraps/bike-wraps/tank-wraps/slim-tank-wraps" },
    { name: "Bonnet Wraps", link: "/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps" },
  ];

  return (
    <div className={styles.cardContainer}>
      {isMobile ? (
        <Swiper
          spaceBetween={-20}         // Reduced gap between slides
          grabCursor={true}         // Enables touch swipe
          loop={false}              // Non-looping slider
          slidesPerView={2}         // Default: 2 slides per view for narrow screens
          observer={true}           // Observe changes in Swiper's elements
          observeParents={true}     // Observe changes in parent elements
          breakpoints={{
            480: { slidesPerView: 3 },  // For widths 480px and above, show 3 slides
            760: { slidesPerView: 4 },  // For widths 760px and above, show 4 slides
          }}
        >
          {cardData.map((item, index) => (
            <SwiperSlide key={index}>
              <Link href={item.link} className={styles.cardLink}>
                <div className={index === 0 ? styles.cardWithImg : styles.card}>
                  <span className={styles.cardText}>{item.name}</span>
                </div>
              </Link>
            </SwiperSlide>
          ))}
        </Swiper>
      ) : (
        <div className={styles.cardRow}>
          {cardData.map((item, index) => (
            <Link href={item.link} key={index} className={styles.cardLink}>
              <div className={index === 0 ? styles.cardWithImg : styles.card}>
                <span className={styles.cardText}>{item.name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductCategoryBox;




