"use client";
import { useMemo, useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import Image from 'next/image';
import styles from './styles/nomargincarousel.module.css';

export default function NoMarginCarousel({ 
  images = [],
  autoplay = true,
  autoplayDelay = 4000,
  showPagination = true,
  className = ""
}) {
  // Use state and effect to handle client-side media query detection
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set client flag to prevent hydration mismatch
    setIsClient(true);
    
    // Check initial screen size
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 500);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Process images based on device type
  const processedImages = useMemo(() => {
    if (!images.length) return [];
    
    return images.map((image, index) => {
      if (typeof image === 'string') {
        return image;
      }
      
      // Handle object with desktop/mobile variants
      if (image.useSameMediaForAllDevices || !image.mobile) {
        return image.desktop || image;
      }
      
      // On server or before client hydration, default to desktop image
      if (!isClient) {
        return image.desktop || image;
      }
      
      return isMobile ? 
        (image.mobile || image.desktop || image) : 
        (image.desktop || image);
    });
  }, [images, isMobile, isClient]);

  const swiperSettings = {
    modules: [Pagination, ...(autoplay ? [Autoplay] : [])],
    pagination: showPagination ? {
      clickable: true,
      bulletClass: "swiper-pagination-bullet custom-bullet",
      bulletActiveClass: "swiper-pagination-bullet-active custom-bullet-active",
    } : false,
    autoplay: autoplay ? {
      delay: autoplayDelay,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    } : false,
    loop: processedImages.length > 1,
    speed: 800,
    effect: 'slide',
    allowTouchMove: true,
    grabCursor: true,
  };

  if (!processedImages.length) {
    return null;
  }

  return (
    <div className={`${styles.carouselContainer} ${className}`}>
      <Swiper {...swiperSettings} className={styles.swiper}>
        {processedImages.map((imageSrc, index) => (
          <SwiperSlide key={index} className={styles.slide}>
            <div className={styles.imageWrapper}>
              <Image
                src={imageSrc}
                alt={`Carousel slide ${index + 1}`}
                fill
                style={{ objectFit: 'cover' }}
                priority={index === 0}
                sizes="100vw"
                unoptimized={process.env.NODE_ENV === "development"}
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
