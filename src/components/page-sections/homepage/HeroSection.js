"use client"
import { useState, useEffect } from 'react';
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

    useEffect(() => {
        const isEOMPeriod = isLastFiveDaysOfMonth();
        const images = [
            ...(isEOMPeriod ? [`${baseUrl}/assets/carousels/homepage-main/eom.png`] : []),
            `${baseUrl}/assets/carousels/homepage-main/first-three-products-banner.jpg`,
            `${baseUrl}/assets/carousels/homepage-main/car-pillar-wraps-shinobi.jpg`,
            `${baseUrl}/assets/carousels/homepage-main/bonnet-strip-wraps-assassin.jpg`,
            `${baseUrl}/assets/carousels/homepage-main/tank-wraps-peace.jpg`
        ];
        setCarouselImages(images);
    }, [baseUrl]);

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
