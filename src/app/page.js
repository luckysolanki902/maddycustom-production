import React from 'react';
import HeroSection from '@/components/page-sections/homepage/HeroSection';
import styles from '@/styles/home.module.css';
import ChooseCategory from '@/components/page-sections/homepage/ChoseCategory';
import CategorySearchBox from '@/components/utils/CategorySearchBox';
import OurUniqueProductCarousel from '@/components/showcase/carousels/OurUniqueProductCarousel';
import FlexibleLargePoster from '@/components/showcase/posters/FlexibleLargePoster';
import HalfBikes from '@/components/page-sections/homepage/halfBikes';
import HappyCustomers from '@/components/showcase/sliders/HappyCustomers';
import Image from 'next/image';
import { createMetadata } from '@/lib/metadata/create-metadata';
import {
  fetchOurUniqueProducts,
  fetchRandomProducts,
  fetchHappyCustomers,
  fetchSearchCategories,
  fetchFeaturedproducts,
} from '@/lib/utils/fetchutils';
import ProductSlider from '@/components/showcase/sliders/ProductSlider';
import FeaturedProducts from '@/components/page-sections/homepage/FeaturedProducts';
import { Box, Typography } from '@mui/material';
import KeychainImageGrid from '@/components/page-sections/homepage/KeychainImageGrid';

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
  happyCustomersData,
  searchCategoriesData,
] = await Promise.all([
  fetchOurUniqueProducts(),
  fetchRandomProducts('f', 10), // Pass your specific category slug here
  fetchFeaturedproducts('f'),
  fetchHappyCustomers(null),
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
        {/* Logo and Main Carousel */}
        <HeroSection />

        {/* SearchBox */}
        <div className={styles.chooseDiv}>CHOOSE</div>
        <CategorySearchBox categories={categories} variants={variants} />

        {/* Category cards like Helmet, Tank, Bonnet to choose from */}
        <ChooseCategory />

        <KeychainImageGrid />

        {/* Our Unique Products */}
        <OurUniqueProductCarousel products={ourUniqueProductsData} />

        {/* Random Products Slider (formerly Helmet Slider) */}
        {/* <Box
          sx={{
            textAlign: 'center',
            mt: { xs: 4, md: 6 },
            mb: { xs: 4, md: 6 },
            fontSize: { xs: '1.5rem', md: '2rem' },
            fontWeight: 600,
            fontFamily: 'Jost',
          }}
        >
          Car Tank Cap Wrap
        </Box> */}

        <div className={styles.doubleGrid}>
          <Image src={`${baseImageUrl}/assets/posters/first-brand-surprise-banner.png`} alt='doublegrid' width={1000} height={500}></Image>
          <Image src={`${baseImageUrl}/assets/posters/tank-cap-wrap-banner.png`} alt='doublegrid' width={1000} height={500}></Image>
        </div>
        <ProductSlider slides={randomProductsData} />

        {/* Bonnet Strip Wrap Poster */}
        <FlexibleLargePoster
          imageSlugForPc='bonnetstrippc.jpg'
          imageSlugForPhone='bonnetstripphone.jpg'
          link='/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps'
        />

        {/* Featured Products */}
        <FeaturedProducts data={featuredBikeWrapsData} />

        {/* Happy Customers */}
        <div className={styles.featuredHead} style={{marginBottom:'-2rem', marginTop:'1rem'}}>
          <Image
            width={940}
            height={256}
            alt='heading - featured products'
            src={`${baseImageUrl}/assets/icons/happycustomers.png`}
          />
        </div>
        <HappyCustomers data={happyCustomersData} noHeading={true} noShadow={true} />

        {/* Animated Half Bikes */}
        <HalfBikes />

      </main>
    </>
  );
};

export default HomePage;
