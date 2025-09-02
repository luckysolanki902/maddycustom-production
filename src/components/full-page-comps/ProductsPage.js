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
import Link from 'next/link';
import { useMediaQuery, Pagination } from '@mui/material';
import { useSpring, animated } from 'react-spring';
import { useDispatch } from 'react-redux';

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
import IsolatedTopBoughtProducts from '@/components/showcase/products/IsolatedTopBoughtProducts';
import { showTopStrip, hideTopStrip } from '@/store/slices/uiSlice';
import { HIDE_PRODUCT_VIDEOS } from '@/lib/constants/featureToggles';

/* ------------------------------------------------------------------ */
/* Smooth "Top-Bought" fade-in/slide-up wrapper                        */
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

// Static version of top-bought section to prevent rerendering issues
// eslint-disable-next-line react/display-name
const StaticTopBought = memo(({ singleVariantCode, containerStyle = {} }) => {
  return (
    <div className={styles.topBoughtContainer} style={containerStyle}>
      <TopBoughtProducts 
        singleVariantCode={singleVariantCode} 
        pageType="products-list"
        key={`static-${singleVariantCode}`} // Stable key to prevent remounting
      />
    </div>
  );
});

// Completely stable version that doesn't re-render at all
// eslint-disable-next-line react/display-name
const StableTopBought = memo(({ singleVariantCode, containerStyle = {} }) => {
  return (
    <div className={styles.topBoughtContainer} style={containerStyle}>
      <IsolatedTopBoughtProducts 
        singleVariantCode={singleVariantCode} 
        pageType="products-list"
        hideHeading={false}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if singleVariantCode actually changes
  return prevProps.singleVariantCode === nextProps.singleVariantCode;
});

export default function ProductsPage({
  slug,
  variant,
  products: initialProducts,
  category,
  initialPage,
  totalPages,
  uniqueTags,
  isNewLaunch: isNewLaunchFromAPI,
}) {
  /* ------------------------ state ------------------------ */
  const SHOW_TOP_BOUGHT = category.specificCategoryCode !== 'tw'; // Controls visibility of TopBought section and product distribution
  const dispatch = useDispatch();

  const [tagFilter, setTagFilter] = useState(null);
  const [sortBy, setSortBy] = useState('default');
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [totalPageCount, setTotalPageCount] = useState(totalPages || 1);
  const [currentProducts, setCurrentProducts] = useState(initialProducts || []);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showLayout2, setShowLayout2] = useState(variant?.listLayout === '2');
  const [isNewLaunch, setIsNewLaunch] = useState(isNewLaunchFromAPI || false);

  // Stable references to prevent TopBoughtProducts re-renders
  const stableRecommendedKey = useMemo(
    () => recommendationMap[variant?.variantCode] || 'win',
    [variant?.variantCode]
  );
  
  const stableVariantCode = useMemo(
    () => variant?.variantCode,
    [variant?.variantCode]
  );

  /* ------------------------ effects ------------------------ */
  // useEffect(() => {
  //   if (variant?.popupDetails?.length) setDialogOpen(true);
  // }, [variant?.popupDetails]);

  useEffect(() => {
    setShowLayout2(variant?.listLayout === '2');
  }, [variant]);

  // TopStrip management effect
  useEffect(() => {
    // Show TopStrip if category matches the specific ID
    if (category?._id === '67d95873451481014c7d0bb2') {
      dispatch(showTopStrip({ 
        categoryId: category._id,
        data: {
          images: {
            pc: 'freshener strip_banner_pc.jpg',
            phone: 'freshener strip_banner_phone.jpg'
          }
        }
      }));
    } else {
      // Hide TopStrip for other categories
      dispatch(hideTopStrip());
    }

    // Cleanup when component unmounts
    return () => {
      dispatch(hideTopStrip());
    };
  }, [category?._id, dispatch]);

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
          // Update isNewLaunch if it's available in the response
          if (data.hasOwnProperty('isNewLaunch')) {
            setIsNewLaunch(data.isNewLaunch);
          }
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
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallDevice  = useMediaQuery('(max-width: 600px)');
  const isMediumDevice = useMediaQuery('(max-width: 1024px)');
  const isLargeDevice  = useMediaQuery('(min-width: 1200px)');
  const showVideo      = currentPage === 1;

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

  // Calculate columns per row based on screen size and layout
  const getColumnsPerRow = useCallback(() => {
    if (showLayout2) {
      if (isSmallDevice) return 2;
      if (!isLargeDevice) return 3;
      return 4; // Large device with layout2
    } else {
      if (isSmallDevice) return 1;
      if (isMediumDevice) return 2;
      return 3; // Large device with layout1
    }
  }, [isSmallDevice, isMediumDevice, isLargeDevice, showLayout2]);

  // Determine if video should be shown and where
  const shouldShowVideoInWrapper = useMemo(() => 
    !HIDE_PRODUCT_VIDEOS && variant?.showCase?.[0]?.available && showVideo && !isSmallDevice, 
    [variant?.showCase, showVideo, isSmallDevice]
  );
  
  const shouldShowVideoInPage = useMemo(() => 
    !HIDE_PRODUCT_VIDEOS && variant?.showCase?.[0]?.available && showVideo && isSmallDevice, 
    [variant?.showCase, showVideo, isSmallDevice]
  );

  // Improved product distribution logic with complete row calculation
  const [firstHalf, secondHalf] = useMemo(() => {
    if (!SHOW_TOP_BOUGHT || currentPage !== 1) return [currentProducts, []];
    
    const columnsPerRow = getColumnsPerRow();
    const videoOffset = shouldShowVideoInWrapper ? 1 : 0;
    const totalItems = currentProducts.length;
    
    if (totalItems <= columnsPerRow - videoOffset) {
      // Not enough items to worry about distribution
      return [currentProducts, []];
    }
    
    // Calculate how many complete rows we need for first half
    // We want to fill complete rows before TopBoughtProducts
    const itemsPerCompleteRow = columnsPerRow;
    const totalSlotsWithVideo = totalItems + videoOffset;
    const totalRows = Math.ceil(totalSlotsWithVideo / itemsPerCompleteRow);
    
    // Aim for half the rows (rounded up) in first section
    const targetRows = Math.ceil(totalRows / 2);
    const targetItems = (targetRows * itemsPerCompleteRow) - videoOffset;
    
    // Ensure we don't create tiny second halves - if less than a half row remains,
    // put everything in the first half
    if (totalItems - targetItems < Math.ceil(columnsPerRow / 2)) {
      return [currentProducts, []];
    }
    
    // Make sure we don't exceed the total number of products
    const actualTargetItems = Math.min(targetItems, totalItems);
    
    return [
      currentProducts.slice(0, actualTargetItems),
      currentProducts.slice(actualTargetItems)
    ];
  }, [currentProducts, currentPage, SHOW_TOP_BOUGHT, getColumnsPerRow, shouldShowVideoInWrapper]);

  const handlePageChange = useCallback((event, newPage) => {
    setCurrentPage(newPage);
    fetchPageData(newPage, tagFilter, sortBy);
    enhancedScrollToTop();
  }, [fetchPageData, tagFilter, sortBy, enhancedScrollToTop]);

  /* ------------------------ chat button styles ------------------------ */
  const chatButtonStyles = {
    position: 'fixed',
    bottom: isSmallDevice ? '90px' : '50px',
    right: isSmallDevice ? '20px' : '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    textDecoration: 'none',
    border: 'none',
    outline: 'none',
  };

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

            {/* Video for small devices - only render here for mobile */}
            {!HIDE_PRODUCT_VIDEOS && shouldShowVideoInPage && (
              <div className={wrapperStyles.videoCard} aria-label="Product Video" style={{ backgroundColor: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 1rem', marginBottom: '2rem', boxShadow: 'none' }}>
                <iframe
                  width="100%"
                  height="100%"
                  src="https://www.youtube.com/embed/MOX9WDmSkCA?autoplay=1&mute=1&loop=1&playlist=MOX9WDmSkCA&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1"
                  title="Product Video"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  style={{ pointerEvents: 'none', backgroundColor: 'white', borderRadius: '1rem'  }}
                />
                {/* <h1>Maddy Custom</h1> */}
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
                hideVideo={HIDE_PRODUCT_VIDEOS || !shouldShowVideoInWrapper} // Global toggle + conditional
              />

              {SHOW_TOP_BOUGHT && <StableTopBought singleVariantCode={stableRecommendedKey} />}

              {SHOW_TOP_BOUGHT && secondHalf.length > 0 && (
                <ProductsWrapper
                  showLayout2={showLayout2}
                  variant={variant}
                  category={category}
                  products={secondHalf}
                  isLoading={isLoading}
                  hideVideo={true} // Never show video in second half
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
              hideVideo={true} // Hide video on non-first pages (also covered by global toggle)
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
            <StableTopBought singleVariantCode={stableRecommendedKey} />
          )}
          
          {/* Extra ribbon of TopBoughtProducts for 'win' variant */}
          {/* {stableVariantCode === 'win' && (
            <StableTopBought 
              singleVariantCode="ucmat" 
              containerStyle={{ 
                marginTop: '2rem',
                padding: '1rem',
                borderTop: '1px solid #eaeaea',
                backgroundColor: '#f9f9f9'
              }}
            />
          )} */}

          <ScrollToTop />
        </div>
      </div>

      {/* WhatsApp Chat Button - Only show for new launch products */}
      {isNewLaunch && (
        <Link 
          href="https://wa.me/8112673988" 
          target="_blank" 
          rel="noopener noreferrer"
          style={chatButtonStyles}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }}
        >
          <Image
            src={`${baseImageUrl}/assets/icons/chatwithus.png`}
            alt="Chat with us on WhatsApp"
            width={isSmallDevice ? 80 : 100}
            height={isSmallDevice ? 40 : 50}
            style={{ objectFit: 'contain', width: '120px', height: 'auto' }}
          />
        </Link>
      )}

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
