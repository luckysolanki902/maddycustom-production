// components/cards/HeaderCarousel.js
"use client";

import React from 'react';
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css"; // Import Swiper styles
import "swiper/css/pagination"; // Import Pagination styles
import 'swiper/css/navigation';
import { Pagination, Autoplay } from 'swiper/modules'; // Corrected import
import { register } from 'swiper/element/bundle';
import Image from 'next/image';
import styles from './styles/headercarousel.module.css';
register();
const HeaderCarousel = () => {
    
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
    // Dummy images for the carousel
    
    const carouselImages = [
        "tank_carousel1.jpg",
        "tank_carousel2.jpg",
        "tank_carousel3.jpg",
    ];


  return (
    <>
      <Swiper
        modules={[Pagination, Autoplay]}
        spaceBetween={30}
        slidesPerView={1}
        autoplay={{ delay: 3000, disableOnInteraction: false }} // Auto-slide every 3 seconds
        loop={true}
        style={{ width: '100%' }}
      >
        {carouselImages.map((imgSrc, index) => (
          <SwiperSlide key={index}>
            <Image
              src={`${baseImageUrl}/assets/carousels/header-carousels/${imgSrc}`}
              alt={`Carousel Image ${index + 1}`}
              width={1242 * 2}
              height={547 * 2}
              style={{ width: '100%', height: 'auto', cursor: 'pointer' }}
              className={styles.carouselImage}
              priority={index === 0} // Preload the first image
            />
          </SwiperSlide>
        ))}
      </Swiper>
      <div className={styles.headingDiv}>
        <h1>Maddy Custom</h1>
      </div>
    </>
  );
};

export default HeaderCarousel;
