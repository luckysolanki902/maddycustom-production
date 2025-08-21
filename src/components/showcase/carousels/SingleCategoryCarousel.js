"use client";

import React, { useState, useRef, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { register } from "swiper/element/bundle";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@mui/material";
import styles from "./styles/win.module.css";

register();

const Card = ({ imageSrc, name, price, link }) => {
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleClick = () => {
    if (link) router.push(link);
  };

  return (
    <div
      className={styles.cardStyles}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" ? handleClick() : null)}
      aria-label={`${name} ₹${price}`}
    >
      <div className={styles.cardImageWrapper}>
        {!imageLoaded && <div className={styles.skeletonLoader} />}
        <Image
          src={imageSrc}
          alt={name}
          width={1242}
          height={647}
          quality={90}
          priority
          onLoad={() => setImageLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            opacity: imageLoaded ? 1 : 0,
            transition: "opacity 0.4s ease",
            borderRadius: "0.2rem 0.2rem 0 0",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
      </div>

      <h3 className={styles.h3}>{name}</h3>

      <p className={styles.detailp} aria-label={`Price ₹${price}`}>
        <span className={styles.rs}>₹</span>
        <span className={styles.price}>{price}</span>
      </p>

      <div className={styles.orderpng}>
        <Image
          width={120}
          height={65}
          src={`${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/icons/order.png`}
          alt="Order now"
          priority
        />
      </div>
    </div>
  );
};

export default function SingleCategoryCarousel({ products = [] }) {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || "";
  const isSmallScreen = useMediaQuery("(max-width: 768px)");
  const isMediumScreen = useMediaQuery("(max-width: 1024px)");

  const [activeIdx, setActiveIdx] = useState(0);
  const swiperRef = useRef(null);

  // reset to first slide when products change
  useEffect(() => {
    setActiveIdx(0);
    if (swiperRef.current?.slideToLoop) {
      swiperRef.current.slideToLoop(0);
    }
  }, [products]);

  const getSlidesPerView = () => {
    if (isSmallScreen) return 1;
    if (isMediumScreen) return 2;
    return 3;
  };

  const visiblePages = Math.min(4, Math.max(1, Math.ceil(products.length / getSlidesPerView())));

  return (
    <>
      <div className={styles.trustedSection}>
        <span className={styles.trustedBadge}>TRUSTED by</span>
        <span className={styles.trustedCount}>50,000+ Happy Customer</span>
      </div>

      <div className={styles.mainCarDiv}>
        {/* top pagination pills */}
        <div className={styles.paginationBoxes} role="tablist" aria-label="Carousel pages">
          {Array.from({ length: visiblePages }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.paginationBox} ${activeIdx === i ? styles.activeBox : ""}`}
              onClick={() => swiperRef.current?.slideToLoop(i)}
              aria-selected={activeIdx === i}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <div className={styles.carouselBackground}>
          <h2 className={styles.carouselHeading}>Bike Tank Wraps</h2>

          <Swiper
            onSwiper={(sw) => (swiperRef.current = sw)}
            onSlideChange={(sw) => setActiveIdx(sw.realIndex % visiblePages)}
            className={styles.swipercustom}
            loop
            speed={450}
            simulateTouch
            grabCursor
            slidesPerView={getSlidesPerView()}
            spaceBetween={isSmallScreen ? 16 : 28}
            centeredSlides={isSmallScreen}
            autoplay={{ delay: 3200, disableOnInteraction: false }}
          >
            {products.map((card, index) => (
              <SwiperSlide
                key={index}
                style={{
                  background: "transparent",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Card
                  imageSrc={`${baseImageUrl}${
                    card.images?.[0]?.startsWith("/") ? card.images[0] : `/${card.images?.[0] || ""}`
                  }`}
                  name={card.name}
                  price={card.price}
                  link={`/shop${card.pageSlug?.split('/').slice(0, -1).join('/') || ''}`}
                />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
    </>
  );
}
