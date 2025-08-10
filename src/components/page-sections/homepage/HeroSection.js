"use client"
import { useState, useEffect, useMemo } from 'react';
import { useMediaQuery } from '@mui/material';
import FullWidthRoundCornerLandscapeCarousel from '@/components/showcase/carousels/FullWidthRoundCornerLandscapeCarousel';
// import Searchbox from '@/components/Searchbox';
import Image from 'next/image';
import styles from './styles/herosection.module.css';
import { useRouter } from 'next/navigation';
// import SaleBanner from '@/components/showcase/banners/SaleBanner';
import { isLastFiveDaysOfMonth } from '@/lib/utils/dateUtils';

export default function HeroSection() {
    const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL
    const router = useRouter()
    const [carouselImages, setCarouselImages] = useState([]);
    
    // Use media query to detect mobile/tablet vs desktop
    const isMobile = useMediaQuery('(max-width:1024px)');

    // Define image objects for both mobile and desktop using useMemo
    const imageConfig = useMemo(() => ({
        desktop: {
            eom: `${baseUrl}/assets/carousels/homepage-main/eom2.png`,
            firstThreeProducts: `${baseUrl}/assets/carousels/homepage-main/first-three-products-banner.jpg`,
            roofwrap: `${baseUrl}/assets/carousels/homepage-main/roofwrap.jpg`,
            carPillarWraps: `${baseUrl}/assets/carousels/homepage-main/car-pillar-wraps-shinobi.jpg`,
            mat: `${baseUrl}/assets/carousels/homepage-main/mat.jpg`,
            bonnetStrip: `${baseUrl}/assets/carousels/homepage-main/bonnet-strip-wraps-assassin.jpg`,
            tankWraps: `${baseUrl}/assets/carousels/homepage-main/tank-wraps-peace.jpg`
        },
        mobile: {
            eom: `${baseUrl}/assets/carousels/homepage-main/mobile/eom2.png`,
            firstThreeProducts: `${baseUrl}/assets/carousels/homepage-main/mobile/first-three-products-banner.jpg`,
            roofwrap: `${baseUrl}/assets/carousels/homepage-main/mobile/roofwrap.jpg`,
            carPillarWraps: `${baseUrl}/assets/carousels/homepage-main/mobile/car-pillar-wraps-shinobi.jpg`,
            mat: `${baseUrl}/assets/carousels/homepage-main/mobile/mat.jpg`,
            bonnetStrip: `${baseUrl}/assets/carousels/homepage-main/mobile/bonnet-strip-wraps-assassin.jpg`,
            tankWraps: `${baseUrl}/assets/carousels/homepage-main/mobile/tank-wraps-peace.jpg`
        }
    }), [baseUrl]);

    useEffect(() => {
        const isEOMPeriod = isLastFiveDaysOfMonth();
        
        // Select the appropriate image set based on device type
        const currentImages = isMobile ? imageConfig.mobile : imageConfig.desktop;
        
        const images = [
            ...(isEOMPeriod ? [currentImages.eom] : []),
            currentImages.firstThreeProducts,
            currentImages.roofwrap,
            currentImages.carPillarWraps,
            currentImages.mat,
            currentImages.bonnetStrip,
            currentImages.tankWraps
        ];
        
        setCarouselImages(images);
    }, [baseUrl, isMobile, imageConfig]);

    return (
        <>
            {/* <SaleBanner /> */}
            <div id='searchyourbikeinput' style={{paddingTop: '2rem'}}>
                <div className={styles.carouseldiv}>
                    <FullWidthRoundCornerLandscapeCarousel images={carouselImages} />
                </div>
            </div>
        </>
    );
}
