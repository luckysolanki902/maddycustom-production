"use client"
import FullWidthRoundCornerLandscapeCarousel from '@/components/showcase/carousels/FullWidthRoundCornerLandscapeCarousel';
// import Searchbox from '@/components/Searchbox';
import Image from 'next/image';
import styles from './styles/herosection.module.css';

export default function HeroSection() {
    const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL
    return (
        <>
            <div className={styles.logoDiv}>
                <Image
                    className={styles.logoImg}
                    src={`${baseUrl}/assets/logos/maddycustom-old-full-logo-horizontal.png`}
                    alt='maddylogo'
                    title='maddylogo'
                    width={976}
                    height={406}
                    priority={true}
                />
            </div>
            <div id='searchyourbikeinput'>
                <div className={styles.carouseldiv}>
                    <FullWidthRoundCornerLandscapeCarousel images={[
                        // `${baseUrl}/assets/carousels/homepage-main/new_year_24_carousel.png`,
                        `${baseUrl}/assets/carousels/homepage-main/first-three-products-banner.jpg`,
                        `${baseUrl}/assets/carousels/homepage-main/car-pillar-wraps-shinobi.jpg`,
                        `${baseUrl}/assets/carousels/homepage-main/bonnet-strip-wraps-assassin.jpg`,
                        `${baseUrl}/assets/carousels/homepage-main/tank-wraps-peace.jpg`
                    ]} />
                </div>
            </div>
        </>
    );
}
