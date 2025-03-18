"use client";

import React from "react";
import { useMediaQuery } from "@mui/material";
import Image from "next/image";
import Link from "next/link";
import styles from "./styles/flexiblelargeposter.module.css";

// Swiper imports
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { register } from "swiper/element/bundle";
register();

/**
 * FlexibleLargePosterCarousel
 * 
 * Accepts an array of items, where each item is:
 *   {
 *      pcImage: "somePcImage.jpg",
 *      phoneImage: "somePhoneImage.jpg",
 *      link: "/some-route"
 *   }
 * 
 * For each item, the component displays either the pcImage or the phoneImage
 * based on screen size, wrapped in a <Link> (leading to the item's link).
 */
export default function FlexibleLargePosterCarousel({ items = [] }) {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallScreen = useMediaQuery("(max-width: 600px)");

  return (
    <div className={styles.bigPoster}>
      <Swiper
        loop={true}
        autoplay={{ delay: 3000, disableOnInteraction: false }}
        speed={500}
        style={{ width: "100%" }}
      >
        {items.map((item, index) => {
          const imageFile = isSmallScreen ? item.phoneImage : item.pcImage;
          return (
            <SwiperSlide key={index}>
              <Link href={item.link}>
                <Image
                  src={`${baseImageUrl}/assets/posters/${imageFile}`}
                  alt={`poster-image-${index}`}
                  width={1242}
                  height={547}
                  style={{ width: "100%", height: "auto" }}
                  priority={index === 0 ? true : false}
                />
              </Link>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
