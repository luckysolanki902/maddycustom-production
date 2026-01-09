import React from 'react';
import HeroCarousel from '@/components/page-sections/homepage/HeroCarousel';
import NewArrival from '@/components/page-sections/homepage/NewArrival';
import CategoryGrid from '@/components/page-sections/homepage/CategoryGrid';
import styles from '@/styles/home.module.css';
import CategorySearchBox from '@/components/utils/CategorySearchBox';
import AnimatedSearchBox from '@/components/utils/AnimatedSearchBox';
// import HappyCustomers from '@/components/showcase/sliders/HappyCustomers';
import { createMetadata } from '@/lib/metadata/create-metadata';
import { fetchSearchCategories, fetchDisplayAssets, fetchOurUniqueProducts } from '@/lib/utils/fetchutils';
import WhyMaddy from '@/components/page-sections/homepage/WhyMaddy'
import CarIntExtWrapper from '@/components/page-sections/homepage/CarIntExtWrapper';
import { Box } from '@mui/material';
import ProductCategorySlider from '@/components/page-sections/homepage/ProductCategorySlider';
import SingleCategorySlider from '@/components/showcase/carousels/SingleCategoryCarousel';
import VoiceOfOurCustomers from '@/components/page-sections/homepage/VoiceOfCustomers';
import CustomerPhotosSlider from '@/components/page-sections/homepage/CustomerPhotosSlider';

export const dynamic = 'force-dynamic';

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

  // Helper to make links root-relative
  const toRelativeLink = (link) => {
    if (!link) return link;
    try {
      if (/^https?:\/\//i.test(link)) {
        const u = new URL(link);
        return (u.pathname || '/') + (u.search || '') + (u.hash || '');
      }
      if (/^\/\//.test(link)) {
        const u = new URL('https:' + link);
        return (u.pathname || '/') + (u.search || '') + (u.hash || '');
      }
      return link.startsWith('/') ? link : '/' + link;
    } catch (e) {
      return link.startsWith('/') ? link : '/' + link;
    }
  };

  // Filter assets for customer photos section (componentName or type heuristic)
  const customerPhotoAssets = (displayAssets || [])
  .filter(a => a?.componentName === 'customer-photos-section' || a?.componentId?.includes('customer-photo'))
    .sort((a,b)=>{
      const pa = a.position || '0';
      const pb = b.position || '0';
      const na = parseFloat(pa) || 0;
      const nb = parseFloat(pb) || 0;
      if (na !== nb) return na - nb; // numeric first
      return pa.localeCompare(pb, undefined, { numeric: true, sensitivity: 'base' });
    });

  // Sanitize links in displayAssets and customerPhotoAssets to always be root-relative
  const sanitizeAssets = (arr) => (arr || []).map(a => {
    if (!a) return a;
    try {
      return {
        ...a,
        link: toRelativeLink(a.link)
      };
    } catch (e) {
      return a;
    }
  });

  const safeDisplayAssets = sanitizeAssets(displayAssets);
  const safeCustomerPhotoAssets = sanitizeAssets(customerPhotoAssets);

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
            assets={safeDisplayAssets}
          />
        </div>
        <ProductCategorySlider position="belowHero" />

        {/* Animated Search Box */}
        <AnimatedSearchBox />

  {/* New Arrivals Section */}
  <NewArrival assets={safeDisplayAssets} />

        {/* Category Grid Section */}
  <CategoryGrid assets={safeDisplayAssets} />

        <SingleCategorySlider products={uniqueProductsData} />

  {/* Interior & Exterior Sections */}
  <CarIntExtWrapper assets={safeDisplayAssets} />


        <WhyMaddy />
  <VoiceOfOurCustomers />
  <CustomerPhotosSlider assets={safeCustomerPhotoAssets} />
  


      </main>
    </>
  );
};


export default HomePage;

