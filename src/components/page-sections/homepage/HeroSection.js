"use client"
import FullWidthRoundCornerLandscapeCarousel from '@/components/showcase/carousels/FullWidthRoundCornerLandscapeCarousel';
// import Searchbox from '@/components/Searchbox';
import Image from 'next/image';
import styles from './styles/herosection.module.css';
import { useRouter } from 'next/navigation';

export default function HeroSection() {
    const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL
    const router = useRouter()
    return (
        <>
            {/* <div className={styles.logoDiv}>
                <Image
                    className={styles.logoImg}
                    onClick={() => router.push('/')}
                    style={{ cursor: 'pointer' }}
                    // src={`${baseUrl}/assets/logos/maddycustom-old-full-logo-horizontal.png`}
                    src={`${baseUrl}/assets/logos/maddy_custom3_main_logo.png`}
                    alt='maddylogo'
                    title='maddylogo'
                    width={976}
                    height={406}
                    priority={true}
                />
            </div> */}
            <div id='searchyourbikeinput' style={{paddingTop: '2rem'}}>
                <div className={styles.carouseldiv}>
                    <FullWidthRoundCornerLandscapeCarousel images={[
                        // `${baseUrl}/assets/carousels/homepage-main/eom50.png`,
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
