"use client";
import { useMemo, useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './styles/nomargincarousel.module.css';

export default function NoMarginCarousel({ 
  images = [],
  imagesPlusLinks = [],
  autoplay = true,
  autoplayDelay = 4000,
  showPagination = true,
  className = ""
}) {
  const router = useRouter();
  // Use state and effect to handle client-side media query detection
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Determine which data source to use
  const useLinkedImages = imagesPlusLinks.length > 0;
  const sourceData = useLinkedImages ? imagesPlusLinks : images;

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
    if (!sourceData.length) return [];
    
    return sourceData.map((item, index) => {
      let imageData, linkData = null;
      
      // Handle different data structures
      if (useLinkedImages) {
        // imagesPlusLinks format: { image: {...}, link: "..." }
        imageData = item.image || item;
        linkData = item.link;
      } else {
        // images format: just image data
        imageData = item;
      }

      let processedSrc;
      if (typeof imageData === 'string') {
        processedSrc = imageData;
      } else {
        // Handle object with desktop/mobile variants
        if (imageData.useSameMediaForAllDevices || !imageData.mobile) {
          processedSrc = imageData.desktop || imageData;
        } else {
          // On server or before client hydration, default to desktop image
          if (!isClient) {
            processedSrc = imageData.desktop || imageData;
          } else {
            processedSrc = isMobile ? 
              (imageData.mobile || imageData.desktop || imageData) : 
              (imageData.desktop || imageData);
          }
        }
      }
      
      return {
        src: processedSrc,
        link: linkData
      };
    });
  }, [sourceData, isMobile, isClient, useLinkedImages]);

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

  // Handle click navigation
  const handleSlideClick = (link) => {
    if (link && router) {
      router.push(link);
    }
  };

  return (
    <div className={`${styles.carouselContainer} ${className}`}>
      <Swiper {...swiperSettings} className={styles.swiper}>
        {processedImages.map((item, index) => (
          <SwiperSlide key={index} className={styles.slide}>
            <div 
              className={styles.imageWrapper}
              onClick={() => handleSlideClick(item.link)}
              style={{
                cursor: item.link ? 'pointer' : 'default'
              }}
            >
              <Image
                src={item.src}
                alt={`Carousel slide ${index + 1}`}
                width={1920}
                height={800}
                style={{ 
                  width: '100%', 
                  height: 'auto',
                  display: 'block'
                }}
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
