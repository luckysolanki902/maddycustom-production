// components/full-page-comps/ProductsPage.js

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import styles from './styles/products.module.css';
import ScrollToTop from '@/components/utils/scrolltotop';
import style from '../cards/styles/productswrapper.module.css';
import { useMediaQuery, Pagination, Stack, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import ProductsWrapper from '../cards/ProductsWrapper';
import Tags from '../page-sections/products-page/Tags';
import Sidebar from '../layouts/Sidebar';
import ChangeVariantButton from '../page-sections/products-page/ChangeVariantButton';
import { ITEMS_PER_PAGE } from '@/lib/constants/productsPageConsts';
import debounce from 'lodash.debounce';
import { PaginationStyles } from '@/styles/PaginationStyles';
import ContactUs from '../layouts/ContactUs';
import FullWidthRoundCornerLandscapeCarousel from '../showcase/carousels/FullWidthRoundCornerLandscapeCarousel';
import herosectionStyles from '@/components/page-sections/homepage/styles/herosection.module.css';

export default function ProductsPage({ slug, variant, products, category, initialPage, totalPages, uniqueTags }) {
  // Constants
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL

  // State for tag filter and sort filter
  const [tagFilter, setTagFilter] = useState(null);
  const [sortBy, setSortBy] = useState('default');
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [totalPageCount, setTotalPageCount] = useState(totalPages || 1);
  const [currentProducts, setCurrentProducts] = useState(products || []);
  const [loading, setLoading] = useState(false);
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const [scrollToTopOnPageChange, setScrollToTopOnPageChange] = useState(true);
  const [sortSelectInTheUi, setSortSelectInTheUi] = useState(false); // Controlled by a constant

  // Use uniqueTags passed from props
  const allTags = uniqueTags;

  const fetchPageData = useCallback(async (page, tag, sort) => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/shop/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: Array.isArray(slug) ? slug.join('/') : slug,
          page: page,
          limit: ITEMS_PER_PAGE,
          tagFilter: tag,
          sortBy: sort,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.type === 'variant') {
          setCurrentProducts(data.products);
          setTotalPageCount(data.totalPages);
          setCurrentPage(data.currentPage);
        } else {
          // Handle other types if necessary
        }
      } else {
        console.error('Failed to fetch data');
      }
    } catch (error) {
      console.error('Error fetching page data:', error);
    }
    setLoading(false);
  }, [slug]);

  // Debounced version of fetchPageData for tag and sort changes
  const debouncedFetchPageData = useCallback(
    debounce((page, tag, sort) => {
      fetchPageData(page, tag, sort);
    }, 300),
    [fetchPageData]
  );

  // Handle tag filter changes
  useEffect(() => {
    setCurrentPage(1); // Reset to first page on tag change
    debouncedFetchPageData(1, tagFilter, sortBy);
    // Cleanup on unmount
    return () => {
      debouncedFetchPageData.cancel();
    };
  }, [tagFilter, sortBy, debouncedFetchPageData]);

  // Handle sort changes
  const handleSortChange = (event) => {
    const newSort = event.target.value;
    setSortBy(newSort);
    setCurrentPage(1); // Reset to first page on sort change
    debouncedFetchPageData(1, tagFilter, newSort);
  };

  // Handle page changes
  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    fetchPageData(value, tagFilter, sortBy);
    if (value !== 1 && value > totalPageCount) {
      // Adjust if page exceeds total
      setCurrentPage(totalPageCount);
    }
  };

  // Scroll to top on page change
  useEffect(() => {
    if (scrollToTopOnPageChange) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, scrollToTopOnPageChange]);

  return (
    <div>
      <Sidebar />
      <header>
        <div className={styles.headContainer}>
          <div className={styles.headingFlex}>
            <h1 className={styles.bikeHeading}>{variant.name}
            {variant?.name?.toLowerCase().includes('tank') && (
            <button
                variant="contained"
                className={styles.sizebutton}
            >
                {variant?.name === "Slim Tank Wraps"
                    ? "6.8 cm wide"
                    : variant?.name === "Medium Tank Wraps"
                    ? "7 cm wide"
                    : variant?.name === "Wide Tank Wraps"
                    ? "19.05 cm wide"
                    : null}
            </button>
        )}</h1>
            {variant?.subtitles.length > 0 && variant?.subtitles[0] && (
              variant.variantCode === 'hel' ?
                <>
                  <h2 className={styles.helmetTagline}>&quot;Best designed helmets of India <br /> with safety of&quot;</h2>
                  <Image
                    className={styles.studds}
                    src={`${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${variant?.availableBrands[0]?.brandLogo}`}
                    width={1103 / 5}
                    height={394 / 5}
                    alt={'studds'}
                  />
                </>
                :
                <h2 className={styles.belowMainHeading}>{variant?.subtitles[0]}</h2>
            )}
          </div>
        </div>
      </header>

      {/* Video Embed for Small Devices */}
      {variant.showCase?.[0]?.available && isSmallDevice && (
        <div
          className={style.videoCard}
          aria-label="Product Video"
        >
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/embed/MOX9WDmSkCA?autoplay=1&mute=1&loop=1&playlist=MOX9WDmSkCA&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1"
            title="Product Video"
            allow="autoplay; encrypted-media"
            allowFullScreen
            style={{ pointerEvents: 'none' }}
          ></iframe>
          <h1>Maddy Custom</h1>
        </div>
      )}

      {/* Video Embed for Small Devices */}
      {category.specificCategoryCode === 'tw' && isSmallDevice &&
        <div className={herosectionStyles.carouseldiv}>
          <FullWidthRoundCornerLandscapeCarousel images={[
            `${baseImageUrl}/assets/carousels/header-carousels/tank_carousel1.jpg`,
            `${baseImageUrl}/assets/carousels/header-carousels/tank_carousel2.jpg`,
            `${baseImageUrl}/assets/carousels/header-carousels/tank_carousel3.jpg`,
          ]} />
        </div>
      }

      {/* Pass uniqueTags to Tags component */}
      <Tags setTagFilter={setTagFilter} tags={allTags} />

      {sortSelectInTheUi && (
        <FormControl variant="outlined" className={styles.sortSelect}>
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
        </FormControl>
      )}

      <ChangeVariantButton category={category} />

      <ProductsWrapper
        variant={variant}
        products={currentProducts}
        category={category}
        sortBy={sortBy}
        loading={loading}
      />

      <PaginationStyles>
        <Pagination
          count={totalPageCount}
          page={currentPage}
          onChange={handlePageChange}
          color="primary"
          disabled={loading}
        />
      </PaginationStyles>

      <ScrollToTop />
      <ContactUs />
    </div>
  );
}
