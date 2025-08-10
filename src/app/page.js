import React from 'react';
import HeroCarousel from '@/components/page-sections/homepage/HeroCarousel';
import styles from '@/styles/home.module.css';
import CategorySearchBox from '@/components/utils/CategorySearchBox';
// import HappyCustomers from '@/components/showcase/sliders/HappyCustomers';
import { createMetadata } from '@/lib/metadata/create-metadata';
import {
  fetchSearchCategories,
  fetchDisplayAssets,
} from '@/lib/utils/fetchutils';

import { Box } from '@mui/material';
import ProductCategorySlider from '@/components/page-sections/homepage/ProductCategorySlider';

export async function generateMetadata() {
  return createMetadata({
    title: "MaddyCustom - India's Leading Vehicle Personalization & Custom Car/Bike Wraps Experts",
    canonical: 'https://www.maddycustom.com',
  });
}

const [
  // happyCustomersData,
  searchCategoriesData,
  displayAssetsData,
] = await Promise.all([
  fetchSearchCategories(),
  fetchDisplayAssets('homepage'),
]);
const HomePage = async () => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // Destructure categories and variants from searchCategoriesData
  const { categories, variants } = searchCategoriesData;
  
  // Destructure display assets
  const { assets: displayAssets = [] } = displayAssetsData;
  // Filter assets for hero carousel
  const heroCarouselAssets = displayAssets.filter(asset => 
    asset.componentName === 'hero-carousel' && 
    asset.componentType === 'carousel'
  );
  console.log('hero carousel assets:', { heroCarouselAssets });

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
            assets={heroCarouselAssets}
          />
        </div>

                <ProductCategorySlider position="belowHero" />







        {/* <ProductSlider slides={randomProductsData} /> */}


      </main>
    </>
  );
};

export default HomePage;

