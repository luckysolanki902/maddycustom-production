import React from 'react';
import HeroSection from '@/components/page-sections/homepage/HeroSection';
import styles from '@/styles/home.module.css';
import ChooseCategory from '@/components/page-sections/homepage/ChoseCategory';
import CategorySearchBox from '@/components/utils/CategorySearchBox';
import OurUniqueProductCarousel from '@/components/showcase/carousels/OurUniqueProductCarousel';
import FlexibleLargePoster from '@/components/showcase/posters/FlexibleLargePoster';
// import HalfBikes from '@/components/page-sections/homepage/halfBikes';
// import HappyCustomers from '@/components/showcase/sliders/HappyCustomers';
import Image from 'next/image';
import { createMetadata } from '@/lib/metadata/create-metadata';
import {
  fetchOurUniqueProducts,
  fetchRandomProducts,
  // fetchHappyCustomers,
  fetchSearchCategories,
  fetchFeaturedproducts,
} from '@/lib/utils/fetchutils';
// import ProductSlider from '@/components/showcase/sliders/ProductSlider';
// import FeaturedProducts from '@/components/page-sections/homepage/FeaturedProducts';
// import { Box, Typography } from '@mui/material';
// import KeychainImageGrid from '@/components/page-sections/homepage/KeychainImageGrid';
import ProductCategorySlider from '@/components/page-sections/homepage/ProductCategorySlider';
import NewArrivalProduct from '@/components/page-sections/homepage/NewArrivalProduct';
import ComboProduct from '@/components/page-sections/homepage/ComboProduct';
import WhyMaddy from '@/components/page-sections/homepage/WhyMaddy';
import VoiceOfOurCustomers from '@/components/page-sections/homepage/VoiceOfCustomers';

export async function generateMetadata() {
  return createMetadata({
    title: "MaddyCustom - India's Leading Vehicle Personalization Experts",
    canonical: 'https://www.maddycustom.com',
  });
}

const [
  ourUniqueProductsData,
  randomProductsData, // Now using the new generic endpoint
  featuredBikeWrapsData,
  // happyCustomersData,
  searchCategoriesData,
] = await Promise.all([
  fetchOurUniqueProducts(),
  fetchRandomProducts('f', 10), // Pass your specific category slug here
  fetchFeaturedproducts('caf'),
  // fetchHappyCustomers(null),
  fetchSearchCategories(),
]);

const HomePage = async () => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  // Fetch all necessary data concurrently

  // Destructure categories and variants from searchCategoriesData
  const { categories, variants } = searchCategoriesData;
  return (
    <>

      <main>
        <div style={{position:'sticky',top:0,left:0}}><CategorySearchBox categories={categories} variants={variants} /></div>
        
        
     {/* Render ProductCategoryBox above HeroSection only on screens larger than 1200px */}
     <ProductCategorySlider position="aboveHero" />
        {/* Logo and Main Carousel */}
        <HeroSection />
        <ProductCategorySlider position="belowHero" />

        {/* SearchBox */}

        {/* Category cards like Helmet, Tank, Bonnet to choose from */}
        <ChooseCategory />
      <NewArrivalProduct/>
        {/* <KeychainImageGrid /> */}
        <div className={styles.trustedSection}>
          <span className={styles.trustedBadge}>TRUSTED by</span>
          <span className={styles.trustedCount}>1000+ Happy Customer</span>
        </div>
        {/* Our Unique Products */}
        <OurUniqueProductCarousel products={ourUniqueProductsData} />

    <ComboProduct/>

        <div className={styles.doubleGrid}>
          <Image src={`${baseImageUrl}/assets/posters/first-brand-surprise-banner.png`} alt='doublegrid' width={1000} height={500} className={styles.nomorebanner}></Image>
          <Image src={`${baseImageUrl}/assets/posters/tank-cap-wrap-banner.png`} alt='doublegrid' width={1000} height={500}></Image>
        </div>
        {/* <ProductSlider slides={randomProductsData} /> */}

        {/* Bonnet Strip Wrap Poster */}
        <FlexibleLargePoster
          items={[
            {
              pcImage: "1d_bonnet_bottom-carousel-banner.png",
              phoneImage: "1m_bonnet_bottom-carousel-banner.png",
              link: "/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps",
            },
            {
              pcImage: "2d_frag_bottom-carousel-banner.png",
              phoneImage: "2m_frag_bottom-carousel-banner.png",
              link: "/shop/accessories/car-care/car-air-freshners/hanging-bottle-car-fresheners",
            },
          ]}
        />
              <WhyMaddy/>
        {/* Featured Products */}
        {/* <FeaturedProducts data={featuredBikeWrapsData} /> */}

        {/* Happy Customers */}
        {/* <div className={styles.featuredHead} style={{marginBottom:'-2rem', marginTop:'1rem'}}>
          <Image
            width={940}
            height={256}
            alt='heading - featured products'
            src={`${baseImageUrl}/assets/icons/happycustomers.png`}
          />
        </div> */}
        {/* <HappyCustomers data={happyCustomersData} noHeading={true} noShadow={true} /> */}

        {/* Animated Half Bikes */}
        {/* <HalfBikes /> */}
<VoiceOfOurCustomers/>
      </main>
    </>
  );
};

export default HomePage;

