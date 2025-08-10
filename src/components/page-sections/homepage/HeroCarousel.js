"use client"
import { useState, useEffect, useMemo } from 'react';
import { useMediaQuery } from '@mui/material';
import FullWidthRoundCornerLandscapeCarousel from '@/components/showcase/carousels/FullWidthRoundCornerLandscapeCarousel';
import styles from './styles/herocarousel.module.css';

// Fallback images for loading state
const FALLBACK_IMAGES = {
  desktop: `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/carousels/homepage-main/first-three-products-banner.jpg`,
  mobile: `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/carousels/homepage-main/mobile/first-three-products-banner.jpg`
};

export default function HeroCarousel({ 
  assets = [] // Assets passed from parent component (homepage)
}) {
    console.log({assets})
  const [carouselImages, setCarouselImages] = useState([]);
  
  // Use media query to detect mobile/tablet vs desktop
  const isMobile = useMediaQuery('(max-width:500px)');

  // Process images for carousel based on passed assets
  useEffect(() => {
    if (assets.length > 0) {
      const images = assets.map(asset => {
        // Use appropriate media based on device type and asset configuration
        if (asset.useSameMediaForAllDevices || !asset.media?.mobile) {
          return asset.media?.desktop || FALLBACK_IMAGES.desktop;
        }
        return isMobile ? 
          (asset.media?.mobile || asset.media?.desktop || FALLBACK_IMAGES.mobile) : 
          (asset.media?.desktop || FALLBACK_IMAGES.desktop);
      });
      
      setCarouselImages(images);
    } else {
      // Show fallback image if no assets
      setCarouselImages([isMobile ? FALLBACK_IMAGES.mobile : FALLBACK_IMAGES.desktop]);
    }
  }, [assets, isMobile]);


  return (
    <div id='hero-carousel' >
      <div className={styles.carouseldiv}>
        <FullWidthRoundCornerLandscapeCarousel 
          images={carouselImages}
        />
      </div>
    </div>
  );
}
