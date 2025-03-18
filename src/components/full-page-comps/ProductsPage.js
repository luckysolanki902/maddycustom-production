"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import styles from './styles/products.module.css';
import ScrollToTop from '@/components/utils/scrolltotop';
import style from '../cards/styles/productswrapper.module.css';
import { useMediaQuery, Pagination, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import ProductsWrapper from '../cards/ProductsWrapper';
import Tags from '../page-sections/products-page/Tags';
import ChangeVariantButton from '../page-sections/products-page/ChangeVariantButton';
import { ITEMS_PER_PAGE } from '@/lib/constants/productsPageConsts';
import { PaginationStyles, PaginationStylesForPhone } from '@/styles/PaginationStyles';
import FullWidthRoundCornerLandscapeCarousel from '../showcase/carousels/FullWidthRoundCornerLandscapeCarousel';
import herosectionStyles from '@/components/page-sections/homepage/styles/herosection.module.css';

import VariantDialog from '../dialogs/VariantDialog';

export default function ProductsPage({
  slug,
  variant,
  products: initialProducts,
  category,
  initialPage,
  totalPages,
  uniqueTags
}) {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // States
  const [tagFilter, setTagFilter] = useState(null);
  const [sortBy, setSortBy] = useState('default');
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [totalPageCount, setTotalPageCount] = useState(totalPages || 1);
  const [currentProducts, setCurrentProducts] = useState(initialProducts || []);
  const [isLoading, setIsLoading] = useState(false);

  // const testVariant = {
  //   popupDetails: ['https://deq64r0ss2hgl.cloudfront.net/images/products_gallery_images/premium-keychain-70207109188199.jpg'], // using a placeholder image
  // };

  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const isLargeDevice = useMediaQuery('(min-width: 1200px)');

  // Layout (layout2 for non-wraps)
  const [showLayout2, setShowLayout2] = useState(false);

  // Decide layout only once
  useEffect(() => {
    if (variant && variant.listLayout === '2') {
      setShowLayout2(true);
    }
  }, [variant]);


  // Only fetch if user changes page, tag, or sort from the initial
  const fetchPageData = useCallback(
    async (page, tag, sort) => {
      try {
        setIsLoading(true);

        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/shop/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: Array.isArray(slug) ? slug.join('/') : slug,
            page,
            limit: ITEMS_PER_PAGE,
            tagFilter: tag,
            sortBy: sort,
          }),
        });

        if (!res.ok) {
          console.error('Failed to fetch data');
          return;
        }
        const data = await res.json();
        if (data.type === 'variant') {
          setCurrentProducts(data.products);
          setTotalPageCount(data.totalPages);
          setCurrentPage(data.currentPage);
        }
      } catch (error) {
        console.error('Error fetching page data:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [slug]
  );

  // On Tag or Sort change => go to page 1
  useEffect(() => {
    // Avoid re-fetch if user hasn’t changed anything from defaults
   
    const hasFiltersChanged = !!tagFilter || sortBy !== 'default';
    if (hasFiltersChanged) {
      fetchPageData(1, tagFilter, sortBy);
      setCurrentPage(1);
    }
  }, [tagFilter, sortBy, fetchPageData]);

  // On page change
  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    fetchPageData(value, tagFilter, sortBy);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sort changes
  const handleSortChange = (event) => {
    const newSort = event.target.value;
    setSortBy(newSort);
  };

  // Render
  return (
    <>
      <div style={{ backgroundColor: showLayout2 ? '#F1F3F6' : 'white' }}>
        <div style={{ maxWidth: showLayout2 ? '1200px' : '100%', margin: 'auto' }}>
          <header>
            <div className={styles.headContainer}>
              <div className={styles.headingFlex}>
                <h1
                  className={styles.bikeHeading}
                  style={{
                    fontSize: isLargeDevice
                      ? variant?.name.length > 15
                        ? '2.5rem'
                        : variant?.name.length > 20
                          ? '2rem'
                          : '3.5rem'
                      : variant?.name.length > 15
                        ? '1.8rem'
                        : variant?.name.length > 20
                          ? '1.5rem'
                          : '2.2rem',
                  }}
                >
                  {variant?.name}
                  {variant?.name?.toLowerCase().includes('tank') && (
                    <button
                      className={styles.sizebutton}
                      style={{ backgroundColor: "#d6fcff" }}
                    >
                      {variant?.name === "Slim Tank Wraps"
                        ? "6.8 cm wide"
                        : variant?.name === "Medium Tank Wraps"
                          ? "7 cm wide"
                          : variant?.name === "Wide Tank Wraps"
                            ? "19.05 cm wide"
                            : null}
                    </button>
                  )}
                </h1>

                {variant?.subtitles?.length > 0 && variant?.subtitles[0] && (
                  variant.variantCode === 'hel' ? (
                    <>
                      <h2 className={styles.helmetTagline}>
                        &quot;Best designed helmets of India <br /> with safety of&quot;
                      </h2>
                      <Image
                        className={styles.studds}
                        src={`${baseImageUrl}${variant?.availableBrands?.[0]?.brandLogo || ''}`}
                        width={1103 / 5}
                        height={394 / 5}
                        alt={'studds'}
                      />
                    </>
                  ) : (
                    <h2 className={styles.belowMainHeading}>{variant?.subtitles[0]}</h2>
                  )
                )}
              </div>
            </div>
          </header>

          {/* Video Embed for Small Devices */}
          {variant?.showCase?.[0]?.available && isSmallDevice && (
            <div className={style.videoCard} aria-label="Product Video">
              <iframe
              loading='eager'
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/MOX9WDmSkCA?autoplay=1&mute=1&loop=1&playlist=MOX9WDmSkCA&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1"
                title="Product Video"
                allow="autoplay; encrypted-media"
                allowFullScreen
                style={{ pointerEvents: 'none' }}
              />
              <h1>Maddy Custom</h1>
            </div>
          )}
           <div>
      {/* Your product page content */}
      
     
      {variant.popupDetails && variant?.popupDetails.length > 0 && (
         <VariantDialog imageUrl={`${baseImageUrl}${variant?.popupDetails[0] || ''}`} />
        // <VariantDialog imageUrl={variant.popupDetails[0]} />
      )}
   
      {/* <VariantDialog imageUrl={testVariant.popupDetails[0]} /> */}

    </div>

          {/* If category is "tank wraps" and user is on a small device => show carousel */}
          {category?.specificCategoryCode === 'tw' && isSmallDevice && (
            <div className={herosectionStyles.carouseldiv}>
              <FullWidthRoundCornerLandscapeCarousel
                images={[
                  `${baseImageUrl}/assets/carousels/header-carousels/tank_carousel1.jpg`,
                  `${baseImageUrl}/assets/carousels/header-carousels/tank_carousel2.jpg`,
                  `${baseImageUrl}/assets/carousels/header-carousels/tank_carousel3.jpg`,
                ]}
              />
            </div>
          )}

          {/* Tags */}
          <Tags setTagFilter={setTagFilter} tags={uniqueTags} />

          {/* Sorting */}
          {/* <FormControl variant="outlined" className={styles.sortSelect} size="small">
            <InputLabel id="sort-select-label">Sort By</InputLabel>
            <Select
              labelId="sort-select-label"
              id="sort-select"
              value={sortBy}
              onChange={handleSortChange}
              label="Sort By"
            >
              <MenuItem value="default">Default</MenuItem>
              <MenuItem value="priceLowToHigh">Price: Low to High</MenuItem>
              <MenuItem value="priceHighToLow">Price: High to Low</MenuItem>
              <MenuItem value="latestFirst">Latest First</MenuItem>
              <MenuItem value="oldestFirst">Oldest First</MenuItem>
            </Select>
          </FormControl> */}

          <ChangeVariantButton category={category} />

          {/* Products List */}
          <ProductsWrapper
            showLayout2={showLayout2}
            variant={variant}
            products={currentProducts}
            category={category}
            isLoading={isLoading}
          />

          {/* Pagination */}
          {isSmallDevice ? (
            <PaginationStylesForPhone>
              <Pagination
                count={totalPageCount}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                disabled={isLoading}
                siblingCount={1}
                boundaryCount={1}
              />
            </PaginationStylesForPhone>
          ) : (
            <PaginationStyles>
              <Pagination
                count={totalPageCount}
                page={currentPage}
                onChange={handlePageChange}
                color="primary"
                disabled={isLoading}
                siblingCount={1}
                boundaryCount={1}
              />
            </PaginationStyles>
          )}

          <ScrollToTop />
        </div>
      </div>

      <style jsx global>{`
        body {
          background-color: #F1F3F6;
        }
      `}</style>
    </>
  );
}
