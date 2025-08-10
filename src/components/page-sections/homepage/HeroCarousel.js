"use client"
import { useMemo, useState, useEffect } from 'react';
import FullWidthRoundCornerLandscapeCarousel from '@/components/showcase/carousels/FullWidthRoundCornerLandscapeCarousel';
import styles from './styles/herocarousel.module.css';
import { motion } from 'framer-motion';

// Fallback images for loading state
const FALLBACK_IMAGES = {
  desktop: `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/carousels/homepage-main/first-three-products-banner.jpg`,
  mobile: `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/assets/carousels/homepage-main/mobile/first-three-products-banner.jpg`
};

export default function HeroCarousel({ 
  assets = [] // Assets passed from parent component (homepage)
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

  // Process images for carousel based on passed assets - using useMemo to prevent re-renders
  const carouselImages = useMemo(() => {
    if (assets.length > 0) {
      return assets.map(asset => {
        // Use appropriate media based on device type and asset configuration
        if (asset.useSameMediaForAllDevices || !asset.media?.mobile) {
          return asset.media?.desktop || FALLBACK_IMAGES.desktop;
        }
        // On server or before client hydration, default to desktop image to prevent mismatch
        if (!isClient) {
          return asset.media?.desktop || FALLBACK_IMAGES.desktop;
        }
        return isMobile ? 
          (asset.media?.mobile || asset.media?.desktop || FALLBACK_IMAGES.mobile) : 
          (asset.media?.desktop || FALLBACK_IMAGES.desktop);
      });
    } else {
      // Show fallback image - default to desktop on server to prevent hydration mismatch
      return [(!isClient || !isMobile) ? FALLBACK_IMAGES.desktop : FALLBACK_IMAGES.mobile];
    }
  }, [assets, isMobile, isClient]);


  return (
    <motion.div 
      id='hero-carousel'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
    >
      <div className={styles.carouseldiv}>
        <FullWidthRoundCornerLandscapeCarousel 
          images={carouselImages}
        />
      </div>
    </motion.div>
  );
}
