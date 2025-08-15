import React from 'react';
import HeroCarousel from '@/components/page-sections/homepage/HeroCarousel';
import NewArrival from '@/components/page-sections/homepage/NewArrival';
import CategoryGrid from '@/components/page-sections/homepage/CategoryGrid';
import styles from '@/styles/home.module.css';
import CategorySearchBox from '@/components/utils/CategorySearchBox';
// import HappyCustomers from '@/components/showcase/sliders/HappyCustomers';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { fetchSearchCategories, fetchDisplayAssets, fetchOurUniqueProducts } from '@/lib/utils/fetchutils';
import WhyMaddy from '@/components/page-sections/homepage/WhyMaddy'
import CarIntExtWrapper from '@/components/page-sections/homepage/CarIntExtWrapper';
import { Box } from '@mui/material';
import ProductCategorySlider from '@/components/page-sections/homepage/ProductCategorySlider';
import SingleCategorySlider from '@/components/showcase/carousels/SingleCategoryCarousel';
import VoiceOfOurCustomers from '@/components/page-sections/homepage/VoiceOfCustomers';
import ProductImageSlider from '@/components/page-sections/homepage/ProductImageSlider';

export async function generateMetadata() {
  return createMetadata({
    title: "MaddyCustom - India's Leading Vehicle Personalization & Custom Car/Bike Wraps Experts",
    canonical: 'https://www.maddycustom.com',
  });
}

const HomePage = async () => {
  // Fetch all needed data inside component to avoid any module namespace quirks
  const [searchCategoriesData, displayAssetsData, uniqueProductsData] = await Promise.all([
    fetchSearchCategories(),
    fetchDisplayAssets('homepage'),
    fetchOurUniqueProducts()
  ]);

  const { categories, variants } = searchCategoriesData;
  const { assets: displayAssets = [] } = displayAssetsData;

  return (
    <>

      <main className={styles.main}>
        {/* SearchBox for phone and tab only */}
        <CategorySearchBox categories={categories} variants={variants} />

        {/* Add the carousel padding class to prevent content overlap */}
        <div className={styles.carouselPadding}>
          {/* Render ProductCategoryBox above HeroCarousel only on screens larger than 1200px only*/}
          <ProductCategorySlider position="aboveHero" />

          {/* Logo and Main Carousel */}
          <HeroCarousel
            assets={displayAssets}
          />
        </div>
        <ProductCategorySlider position="belowHero" />


        {/* New Arrivals Section */}
        <NewArrival assets={displayAssets} />

        {/* Category Grid Section */}
        <CategoryGrid assets={displayAssets} />

        <SingleCategorySlider products={uniqueProductsData} />

        {/* Interior & Exterior Sections */}
        <CarIntExtWrapper assets={displayAssets} />

        <WhyMaddy />
        <VoiceOfOurCustomers />
        <ProductImageSlider/>


      </main>
    </>
  );
};

export default HomePage;

