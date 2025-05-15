/* ------------------------------------------------------------------ */
/* components/page-sections/products-page/ProductsPage.jsx            */
/* ------------------------------------------------------------------ */
'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from 'react';
import Image from 'next/image';
import { useMediaQuery, Pagination } from '@mui/material';
import { useSpring, animated } from 'react-spring';

import styles from './styles/products.module.css';
import wrapperStyles from '../cards/styles/productswrapper.module.css';

import ProductsWrapper from '../cards/ProductsWrapper';
import Tags from '../page-sections/products-page/Tags';
import ChangeVariantButton from '../page-sections/products-page/ChangeVariantButton';
import FullWidthRoundCornerLandscapeCarousel from '../showcase/carousels/FullWidthRoundCornerLandscapeCarousel';
import VariantDialog from '../dialogs/VariantDialog';
import ScrollToTop from '@/components/utils/scrolltotop';
import { PaginationStyles, PaginationStylesForPhone } from '@/styles/PaginationStyles';
import { ITEMS_PER_PAGE } from '@/lib/constants/productsPageConsts';
import { recommendationMap } from '@/lib/constants/recommendationMap';
import TopBoughtProducts from '@/components/showcase/products/TopBoughtProducts';

/* ------------------------------------------------------------------ */
/* Smooth “Top-Bought” fade-in/slide-up wrapper                        */
/* (hoisted so it stays mounted across re-renders)                    */
/* ------------------------------------------------------------------ */
// eslint-disable-next-line react/display-name
const AnimatedTopBought = memo(({ singleVariantCode }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const spring = useSpring({
    from: { opacity: 0, transform: 'translateY(24px)' },
    to:   { opacity: isMounted ? 1 : 0, transform: isMounted ? 'translateY(0)' : 'translateY(24px)' },
    config: { tension: 250, friction: 22 },
  });

  return (
    <animated.div style={{ ...spring, willChange: 'transform, opacity' }}>
      <div className={styles.topBoughtContainer}>
        <TopBoughtProducts singleVariantCode={singleVariantCode} pageType="products-list" />
      </div>
    </animated.div>
  );
});

export default function ProductsPage({
  slug,
  variant,
  products: initialProducts,
  category,
  initialPage,
  totalPages,
  uniqueTags,
}) {
  /* ------------------------ state ------------------------ */
  const SHOW_TOP_BOUGHT = category.specificCategoryCode !== 'tw'; // Controls visibility of TopBought section and product distribution

  const [tagFilter, setTagFilter] = useState(null);
  const [sortBy, setSortBy] = useState('default');
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [totalPageCount, setTotalPageCount] = useState(totalPages || 1);
  const [currentProducts, setCurrentProducts] = useState(initialProducts || []);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showLayout2, setShowLayout2] = useState(variant?.listLayout === '2');

  /* ------------------------ effects ------------------------ */
  useEffect(() => {
    if (variant?.popupDetails?.length) setDialogOpen(true);
  }, [variant?.popupDetails]);

  useEffect(() => {
    setShowLayout2(variant?.listLayout === '2');
  }, [variant]);

  /* ------------------------ queries ------------------------ */
  const fetchPageData = useCallback(
    async (page, tag, sort) => {
      try {
        setIsLoading(true);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/shop/products`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: Array.isArray(slug) ? slug.join('/') : slug,
              page,
              limit: ITEMS_PER_PAGE,
              tagFilter: tag,
              sortBy: sort,
            }),
          }
        );

        if (!res.ok) throw new Error('Fetch failed');

        const data = await res.json();
        if (data.type === 'variant') {
          setCurrentProducts(data.products);
          setTotalPageCount(data.totalPages);
          setCurrentPage(data.currentPage);
        }
      } catch (err) {
        console.error('Error fetching page data:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [slug]
  );

  useEffect(() => {
    if (tagFilter || sortBy !== 'default') {
      fetchPageData(1, tagFilter, sortBy);
      setCurrentPage(1);
    }
  }, [tagFilter, sortBy, fetchPageData]);

  /* ------------------------ helpers ------------------------ */
  const isSmallDevice  = useMediaQuery('(max-width: 600px)');
  const isLargeDevice  = useMediaQuery('(min-width: 1200px)');
  const showVideo      = currentPage === 1;
  const recommendedKey = useMemo(
    () => recommendationMap[variant?.variantCode] || 'win',
    [variant?.variantCode]
  );

  // Enhanced scroll to top function with better reliability
  const enhancedScrollToTop = useCallback(() => {
    // Start with requestAnimationFrame to ensure we're in the next paint cycle
    requestAnimationFrame(() => {
      // Add a small delay to ensure page content has rendered
      setTimeout(() => {
        // Try smooth scroll first
        try {
          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        } catch (error) {
          // Fallback for older browsers
          window.scrollTo(0, 0);
        }
        
        // Double-check that we're at the top after animation completes
        setTimeout(() => {
          if (window.pageYOffset > 0) {
            window.scrollTo(0, 0);
          }
        }, 500); // After expected scroll animation
      }, 10);
    });
  }, []);

  const handlePageChange = useCallback((event, newPage) => {
    setCurrentPage(newPage);
    fetchPageData(newPage, tagFilter, sortBy);
    enhancedScrollToTop();
  }, [fetchPageData, tagFilter, sortBy, enhancedScrollToTop]);

  const [firstHalf, secondHalf] = useMemo(() => {
    if (!SHOW_TOP_BOUGHT || currentPage !== 1) return [currentProducts, []];
    const mid = Math.ceil(currentProducts.length / 2);
    return [currentProducts.slice(0, mid), currentProducts.slice(mid)];
  }, [currentProducts, currentPage]);

  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  /* ------------------------ render ------------------------ */
  return (
    <>
      <VariantDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        imageUrl={`${baseImageUrl}${variant?.popupDetails?.[0] || ''}`}
      />

      <div style={{ backgroundColor: showLayout2 ? '#F1F3F6' : 'white' }}>
        <div style={{ maxWidth: showLayout2 ? '1200px' : '100%', margin: 'auto' }}>
          <div className={showLayout2 ? styles.layout2withpadding : ''}>
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
                        style={{ backgroundColor: '#d6fcff' }}
                      >
                        {variant?.name === 'Slim Tank Wraps'
                          ? '6.8 cm wide'
                          : variant?.name === 'Medium Tank Wraps'
                          ? '7 cm wide'
                          : variant?.name === 'Wide Tank Wraps'
                          ? '19.05 cm wide'
                          : null}
                      </button>
                    )}
                  </h1>

                  {variant?.subtitles?.[0] &&
                    (variant.variantCode === 'hel' ? (
                      <>
                        <h2 className={styles.helmetTagline}>
                          &quot;Best designed helmets of India <br /> with safety of&quot;
                        </h2>
                        <Image
                          className={styles.studds}
                          src={`${baseImageUrl}${variant?.availableBrands?.[0]?.brandLogo || ''}`}
                          width={1103 / 5}
                          height={394 / 5}
                          alt="studds"
                        />
                      </>
                    ) : (
                      <h2 className={styles.belowMainHeading}>
                        {variant.subtitles[0]}
                      </h2>
                    ))}
                </div>
              </div>
            </header>

            {variant?.showCase?.[0]?.available && isSmallDevice && showVideo && (
              <div className={wrapperStyles.videoCard} aria-label="Product Video">
                <iframe
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

            {category?.specificCategoryCode === 'tw' && isSmallDevice && (
              <div className={styles.carouseldiv}>
                <FullWidthRoundCornerLandscapeCarousel
                  images={[
                    `${baseImageUrl}/assets/carousels/header-carousels/tank_carousel1.jpg`,
                    `${baseImageUrl}/assets/carousels/header-carousels/tank_carousel2.jpg`,
                    `${baseImageUrl}/assets/carousels/header-carousels/tank_carousel3.jpg`,
                  ]}
                />
              </div>
            )}

            <Tags setTagFilter={setTagFilter} tags={uniqueTags} />
          </div>

          <ChangeVariantButton category={category} />

          {currentPage === 1 ? (
            <>
              <ProductsWrapper
                showLayout2={showLayout2}
                variant={variant}
                category={category}
                products={firstHalf}
                isLoading={isLoading}
                hideVideo={!showVideo}
              />

              {SHOW_TOP_BOUGHT && <AnimatedTopBought singleVariantCode={recommendedKey} />}

              {SHOW_TOP_BOUGHT && secondHalf.length > 0 && (
                <ProductsWrapper
                  showLayout2={showLayout2}
                  variant={variant}
                  category={category}
                  products={secondHalf}
                  isLoading={isLoading}
                  hideVideo
                />
              )}
            </>
          ) : (
            <ProductsWrapper
              showLayout2={showLayout2}
              variant={variant}
              category={category}
              products={currentProducts}
              isLoading={isLoading}
              hideVideo
            />
          )}

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

          {currentPage !== 1 && SHOW_TOP_BOUGHT && (
            <AnimatedTopBought singleVariantCode={recommendedKey} />
          )}

          <ScrollToTop />
        </div>
      </div>

      {/* Global background (kept) */}
      <style jsx global>
        {`
          body {
            background-color: #f1f3f6;
          }
        `}
      </style>
    </>
  );
}
