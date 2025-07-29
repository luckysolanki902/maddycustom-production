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
 *      link: "/some-route",
 *      // For split mode:
 *      pcImage2: "somePcImage2.jpg", (optional)
 *      phoneImage2: "somePhoneImage2.jpg", (optional)
 *      link1: "/first-route", (optional, defaults to link)
 *      link2: "/second-route" (optional, defaults to link)
 *   }
 * 
 * For each item, the component displays either the pcImage or the phoneImage
 * based on screen size, wrapped in a <Link> (leading to the item's link).
 * If split mode (pcImage2/phoneImage2 exists), uses link1 and link2 for separate links.
 */
export default function FlexibleLargePosterCarousel({ items = [], splitGap = 0 }) {
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
          const hasSplit = (isSmallScreen ? item.phoneImage2 : item.pcImage2);
          const imageFile1 = isSmallScreen ? item.phoneImage : item.pcImage;
          const imageFile2 = isSmallScreen ? item.phoneImage2 : item.pcImage2;
          
          // Determine links for split mode
          const link1 = item.link1 || item.link;
          const link2 = item.link2 || item.link;
          
          if (hasSplit) {
            // Split poster: two images side by side
            return (
              <SwiperSlide key={index}>
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "auto",
                    gap: splitGap,
                  }}
                >
                  <div style={{ 
                    flex: 1, 
                    width: "50%", 
                    padding: isSmallScreen ? "4px" : "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Link href={link1} style={{ display: "block", width: "100%" }}>
                      <Image
                        src={`${baseImageUrl}/assets/posters/${imageFile1}`}
                        alt={`poster-image1-${index}`}
                        width={621}
                        height={547}
                        style={{ 
                          width: "100%", 
                          height: "auto", 
                          objectFit: "contain",
                          borderRadius: isSmallScreen ? "8px" : "12px"
                        }}
                        priority={index === 0 ? true : false}
                      />
                    </Link>
                  </div>
                  <div style={{ 
                    flex: 1, 
                    width: "50%", 
                    padding: isSmallScreen ? "8px" : "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Link href={link2} style={{ display: "block", width: "100%" }}>
                      <Image
                        src={`${baseImageUrl}/assets/posters/${imageFile2}`}
                        alt={`poster-image2-${index}`}
                        width={621}
                        height={547}
                        style={{ 
                          width: "100%", 
                          height: "auto", 
                          objectFit: "contain",
                          borderRadius: isSmallScreen ? "8px" : "12px"
                        }}
                        priority={index === 0 ? true : false}
                      />
                    </Link>
                  </div>
                </div>
              </SwiperSlide>
            );
          } else {
            // Single poster
            return (
              <SwiperSlide key={index}>
                <Link href={item.link}>
                  <Image
                    src={`${baseImageUrl}/assets/posters/${imageFile1}`}
                    alt={`poster-image-${index}`}
                    width={1242}
                    height={547}
                    style={{ width: "100%", height: "auto", borderRadius: "16px", objectFit: "cover" }}
                    priority={index === 0 ? true : false}
                  />
                </Link>
              </SwiperSlide>
            );
          }
        })}
      </Swiper>
    </div>
  );
}
