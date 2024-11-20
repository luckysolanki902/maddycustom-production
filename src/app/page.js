import HeroSection from '@/components/page-sections/homepage/HeroSection'
import React from 'react'
import styles from '@/styles/home.module.css'
import ChooseCategory from '@/components/page-sections/homepage/ChoseCategory'
import Sidebar from '@/components/layouts/Sidebar';
import ContactUs from '@/components/layouts/ContactUs'
import CategorySearchBox from '@/components/utils/CategorySearchBox';
import OurUniqueProductCarousel from '@/components/showcase/carousels/OurUniqueProductCarousel';
import FlexibleLargePoster from '@/components/showcase/posters/FlexibleLargePoster';
import HelmetSlider from '@/components/showcase/sliders/HelmetSlider';
import FeaturedFullBikeWraps from '@/components/page-sections/homepage/FeaturedFullBikeWraps';
import HalfBikes from '@/components/page-sections/homepage/halfBikes';
import HappyCustomers from '@/components/showcase/sliders/HappyCustomers';
import Image from 'next/image';
import { createMetadata } from '@/lib/metadata/create-metadata';

export async function generateMetadata() {
  return createMetadata({
    canonical: 'https://www.maddycustom.com',
  });
}

export default function page() {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  return (
    <>
      <Sidebar />

      <main>
        {/* Logo and Main Carousel */}
        <HeroSection />

        {/* SearchBox */}
        <div className={styles.chooseDiv}>CHOOSE</div>
        <CategorySearchBox />

        {/* Category cards like Helmet, Tank, Bonnet to choose from */}
        <ChooseCategory />

        {/* Our Unique Products */}
        <OurUniqueProductCarousel />

        {/* Helmet Poster */}
        <FlexibleLargePoster imageSlugForPc='helmetposterpc' imageSlugForPhone='helmetposterphone' link={'/shop/accessories/safety/graphic-helmets/helmet-store'} />

        {/* Helmet Slider */}
        <HelmetSlider />

        {/* Bonnet Strip Wrap Poster */}
        <FlexibleLargePoster imageSlugForPc='bonnetstrippc' imageSlugForPhone='bonnetstripphone' link={'/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps'} />

        {/* Featured Full Bike Wraps */}
        <FeaturedFullBikeWraps />

        {/* Happycustomers here */}
        <div className={styles.featuredHead}>
                <Image width={940} height={256} alt='heading - featured products' src={`${baseImageUrl}/assets/icons/happycustomers.png`}></Image>
            </div>
        <HappyCustomers noHeading={true} noShadow={true}/>

        {/* Animated Half Bikes */}
        <HalfBikes />
        {/* Footer */}
        <ContactUs />

      </main>
    </>
  )
}
