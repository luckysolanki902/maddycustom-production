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
  const heroCarouselAssets = useMemo(() => 
    assets.filter(
      asset => asset.componentName === 'hero-carousel' && asset.componentType === 'carousel'
    ), 
    [assets]
  );
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
  const carouselData = useMemo(() => {
    if (heroCarouselAssets.length > 0) {
      return heroCarouselAssets.map(asset => {
        // Use appropriate media based on device type and asset configuration
        let imageUrl;
        if (asset.useSameMediaForAllDevices || !asset.media?.mobile) {
          imageUrl = asset.media?.desktop || FALLBACK_IMAGES.desktop;
        } else {
          // On server or before client hydration, default to desktop image to prevent mismatch
          if (!isClient) {
            imageUrl = asset.media?.desktop || FALLBACK_IMAGES.desktop;
          } else {
            imageUrl = isMobile ?
              (asset.media?.mobile || asset.media?.desktop || FALLBACK_IMAGES.mobile) :
              (asset.media?.desktop || FALLBACK_IMAGES.desktop);
          }
        }
        
        return {
          url: imageUrl,
          link: asset.link,
          alt: asset.content || `carousel-image`
        };
      });
    } else {
      // Show fallback image - default to desktop on server to prevent hydration mismatch
      return [{
        url: (!isClient || !isMobile) ? FALLBACK_IMAGES.desktop : FALLBACK_IMAGES.mobile,
        link: null,
        alt: 'carousel-image'
      }];
    }
  }, [heroCarouselAssets, isMobile, isClient]);


  return (
    <motion.div
      id='hero-carousel'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
    >
      <div className={styles.carouseldiv}>
        <FullWidthRoundCornerLandscapeCarousel
          slides={carouselData}
        />
      </div>
    </motion.div>
  );
}
