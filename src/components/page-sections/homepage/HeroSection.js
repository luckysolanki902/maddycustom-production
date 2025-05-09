"use client"
import FullWidthRoundCornerLandscapeCarousel from '@/components/showcase/carousels/FullWidthRoundCornerLandscapeCarousel';
// import Searchbox from '@/components/Searchbox';
import Image from 'next/image';
import { useMediaQuery } from '@mui/material';
import styles from './styles/herosection.module.css';
import { useRouter } from 'next/navigation';

 export default function HeroSection() {
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL
       const router = useRouter()
       const isDesktop = useMediaQuery('(min-width:1000px)')
     
       const desktopImages = [
         `${baseUrl}/assets/carousels/homepage-main/1d_bonnet-wrap.png`,
         `${baseUrl}/assets/carousels/homepage-main/2d_pillar-wrap.png`,
         `${baseUrl}/assets/carousels/homepage-main/3d_tank-wrap.png`,
        
       ]
     
       const mobileImages = [
         `${baseUrl}/assets/carousels/homepage-main/1m_bonnet-wrap.png`,
         `${baseUrl}/assets/carousels/homepage-main/2m_pillar-wrap.png`,
         `${baseUrl}/assets/carousels/homepage-main/3m_tank-wrap.png`,
       ]
     
       const images = isDesktop ? desktopImages : mobileImages
     
       return (
         <div id="searchyourbikeinput" className={styles.heroSection}>
           <div className={styles.carouseldiv}>
             <FullWidthRoundCornerLandscapeCarousel images={images} pagination />
           </div>
         </div>
       )
     }

