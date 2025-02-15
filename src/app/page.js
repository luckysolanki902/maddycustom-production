// @/app/page.js

import React from 'react';
import HeroSection from '@/components/page-sections/homepage/HeroSection';
import styles from '@/styles/home.module.css';
import ChooseCategory from '@/components/page-sections/homepage/ChoseCategory';
import Sidebar from '@/components/layouts/Sidebar';
import ContactUs from '@/components/layouts/ContactUs';
import Footer from '@/components/layouts/Footer';
import CategorySearchBox from '@/components/utils/CategorySearchBox';
import OurUniqueProductCarousel from '@/components/showcase/carousels/OurUniqueProductCarousel';
import FlexibleLargePoster from '@/components/showcase/posters/FlexibleLargePoster';
import HelmetSlider from '@/components/showcase/sliders/HelmetSlider';
import FeaturedFullBikeWraps from '@/components/page-sections/homepage/FeaturedFullBikeWraps';
import HalfBikes from '@/components/page-sections/homepage/halfBikes';
import HappyCustomers from '@/components/showcase/sliders/HappyCustomers';
import Image from 'next/image';
import { createMetadata } from '@/lib/metadata/create-metadata';
import {
  fetchOurUniqueProducts,
  fetchHelmetSlides,
  fetchFeaturedFullBikeWraps,
  fetchHappyCustomers,
  fetchSearchCategories
} from '@/lib/utils/fetchutils';

export async function generateMetadata() {
  return createMetadata({
    title: "MaddyCustom - India's Leading Vehicle Personalization Experts",
    canonical: 'https://www.maddycustom.com',
  });
}

const HomePage = async () => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  // Fetch all necessary data concurrently
  const [
    ourUniqueProductsData,
    helmetSlidesData,
    featuredBikeWrapsData,
    happyCustomersData,
    searchCategoriesData
  ] = await Promise.all([
    fetchOurUniqueProducts(),
    fetchHelmetSlides(),
    fetchFeaturedFullBikeWraps(),
    fetchHappyCustomers(null), // Pass parameters if needed
    fetchSearchCategories()
  ]);

  // Destructure categories and variants from searchCategoriesData
  const { categories, variants } = searchCategoriesData;

  return (
    <>
      <Sidebar />

      <main>
        {/* Logo and Main Carousel */}
        <HeroSection />

        {/* SearchBox */}
        <div className={styles.chooseDiv}>CHOOSE</div>
        <CategorySearchBox
          categories={categories}
          variants={variants}
        />

        {/* Category cards like Helmet, Tank, Bonnet to choose from */}
        <ChooseCategory />

        {/* Our Unique Products */}
        <OurUniqueProductCarousel products={ourUniqueProductsData} />

        {/* Helmet Poster */}

        {/* <FlexibleLargePoster 
            imageSlugForPc='helmetposterpc.jpg' 
            imageSlugForPhone='helmetposterphone.jpg' 
            link='/shop/accessories/safety/graphic-helmets/helmet-store' 
          /> */}


        {/* Helmet Slider */}
        <HelmetSlider slides={helmetSlidesData} />

        {/* Bonnet Strip Wrap Poster */}
        <FlexibleLargePoster 
            imageSlugForPc='bonnetstrippc.jpg' 
            imageSlugForPhone='bonnetstripphone.jpg' 
            link='/shop/wraps/car-wraps/bonnet-wraps/bonnet-strip-wraps' 
          />

        {/* Featured Full Bike Wraps */}
        <FeaturedFullBikeWraps data={featuredBikeWrapsData} />

        {/* Happy Customers */}
        <div className={styles.featuredHead}>
          <Image
            width={940}
            height={256}
            alt='heading - featured products'
            src={`${baseImageUrl}/assets/icons/happycustomers.png`}
          />
        </div>
        <HappyCustomers
          data={happyCustomersData}
          noHeading={true}
          noShadow={true}
        />

        {/* Animated Half Bikes */}
        <HalfBikes />

        <Footer />
        {/* <ContactUs /> */}
      </main>
    </>
  );

};

export default HomePage;
