'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
} from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Skeleton,
  Fade,
  Card,
  CardContent,
  CardMedia,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AddToCartButton from '@/components/utils/AddToCartButton';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
const PAGE_SIZE = 10;

/* ─────────────────── styled helpers ─────────────────── */
const ScrollContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  overflowX: 'auto',
  gap: theme.spacing(2),
  paddingBottom: theme.spacing(3),
  scrollSnapType: 'x proximity',
  '&::-webkit-scrollbar': { display: 'none' },
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
}));
const Sentinel = styled('div')({ width: 1, height: 1 });
const cardSx = {
  width: 200,
  flexShrink: 0,
  scrollSnapAlign: 'start',
  borderRadius: 3,
  transition: 'transform .2s',
  cursor: 'pointer',
  '&:hover': { transform: 'translateY(-6px)', boxShadow: 6 },
};

/* ─────────────────── image helper ─────────────────── */
const getDisplayImage = (product) => {
  if (product.options?.length) {
    const inStock = product.options.find(
      (o) => o.inventoryData?.availableQuantity > 0 && o.images?.length
    );
    if (inStock) return { imageUrl: inStock.images[0], outOfStock: false };

    const first = product.options.find((o) => o.images?.length);
    if (first) return { imageUrl: first.images[0], outOfStock: true };
  }
  if (product.images?.length)
    return {
      imageUrl: product.images[0],
      outOfStock: product.inventoryData?.availableQuantity <= 0,
    };
  return {
    imageUrl: '/images/assets/gifs/helmetloadinggif.gif',
    outOfStock: true,
  };
};

/* ─────────────────── context ─────────────────── */
const TopBoughtContext = React.createContext();

/* ─────────────────── Base component ─────────────────── */
function TopBoughtProductsBase({
  subCategories = [],        // may be omitted by caller
  currentProductId = '',
  excludeProductIds = [],
  singleVariantCode = '',
  singleCategoryCode = '',
  pageType = '', // Added pageType prop
  hideHeading = false,
}) {
  const router = useRouter();
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const skipRef = useRef(0);
  
  // Create insertion details object
  const insertionDetails = {
    component: 'topBoughtProducts',
    pageType: pageType
  };

  /* ---------- Normalise sub‑categories ---------- */
  // Guarantee an array, even when undefined/null is supplied and memoize to prevent re-renders
  const effectiveSubCats = useMemo(() => {
    const subCatArr = Array.isArray(subCategories) ? subCategories : [];
    return subCatArr.length || singleVariantCode || singleCategoryCode
      ? subCatArr
      : ['Car Wraps', 'Car Care'];
  }, [subCategories, singleVariantCode, singleCategoryCode]);

  const subCatKey = useMemo(
    () =>
      [...effectiveSubCats]
        .slice()
        .sort()
        .join('|'), // safe even when array is empty
    [effectiveSubCats]
  );

  /* ---------- State ---------- */
  const [products, setProducts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [specCatName, setSpecCatName] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  /* ---------- De‑dupe set (only used for multi-subcategory mode) ---------- */
  const seenIds = useRef(null);
  
  // Check if we're in random products mode (multi-subcategory) 
  const isRandomProductsMode = !singleVariantCode && !singleCategoryCode && effectiveSubCats.length > 0;
  
  // Initialize seenIds only for random products mode
  if (!seenIds.current && isRandomProductsMode) {
    seenIds.current = new Set([...excludeProductIds, currentProductId].filter(Boolean));
  }
  
  // Track current parameters to prevent unnecessary refetches
  const currentParams = useRef('');
  const isFirstRender = useRef(true);

  /* ---------- Fetcher ---------- */
  const fetchPage = useCallback(
    async (offset, isInitial) => {
      try {
        isInitial ? setLoadingInit(true) : setLoadingMore(true);

        const params = { skip: offset };
        if (effectiveSubCats.length) {
          params.subCategories = effectiveSubCats.join(',');
        }
        if (singleVariantCode) params.singleVariantCode = singleVariantCode;
        if (singleCategoryCode) params.singleCategoryCode = singleCategoryCode;

        const { data } = await axios.get(
          '/api/showcase/products/top-bought',
          { params }
        );

        let {
          products: fetched = [],
          hasMore: more = false,
          specificCategoryName = '',
        } = data || {};

        if (isInitial && specificCategoryName) {
          setSpecCatName(specificCategoryName);
        }

        /* client‑side exclusion only for multi-subcategory mode */
        if (isRandomProductsMode && seenIds.current) {
          fetched = fetched.filter((p) => !seenIds.current.has(p._id));
        }

        /* if too few and we're in random mode, pull next page */
        if (isRandomProductsMode && fetched.length < PAGE_SIZE && more && seenIds.current) {
          fetched.forEach((p) => seenIds.current.add(p._id));
          const extra = await fetchPage(offset + PAGE_SIZE, false);
          fetched = fetched.concat(extra.fetched);
          more = extra.more;
        }

        const ready = fetched.map((p) =>
          Array.isArray(p.options) && p.options.length
            ? { ...p, selectedOption: p.options[0] }
            : p
        );

        // Always update products when we get new data
        if (isInitial) {
          setProducts(ready);
        } else {
          setProducts((prev) => [...prev, ...ready]);
        }
        
        // Add to seenIds only for random products mode
        if (isRandomProductsMode && seenIds.current) {
          ready.forEach((p) => seenIds.current.add(p._id));
        }
        
        setHasMore(more);
        
        if (isInitial) {
          setIsInitialized(true);
        }

        return { fetched: ready, more };
      } catch (err) {
        console.error('Error fetching top bought products:', err);
        
        // On error, only mark as initialized if it's initial load
        if (isInitial) {
          setIsInitialized(true);
          setProducts([]); // Clear products on initial error
        }
        return { fetched: [], more: false };
      } finally {
        isInitial ? setLoadingInit(false) : setLoadingMore(false);
      }
    },
    [effectiveSubCats, singleVariantCode, singleCategoryCode, isRandomProductsMode]
  );

  /* ---------- Initial load ---------- */
  useEffect(() => {
    // Create stable key for current parameters
    const paramsKey = `${effectiveSubCats.join('|')}::${singleVariantCode}::${singleCategoryCode}`;
    
    // Skip if parameters haven't changed and we already have data
    if (currentParams.current === paramsKey && products.length > 0 && isInitialized) {
      return;
    }
    
    // Skip duplicate calls in React strict mode
    if (currentParams.current === paramsKey && isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    // Update current parameters
    currentParams.current = paramsKey;
    isFirstRender.current = false;
    
    // Reset state for new fetch
    skipRef.current = 0;
    setHasMore(false);
    setSpecCatName('');
    setIsInitialized(false);
    setLoadingInit(true);
    
    // Reset seenIds only for random products mode
    if (isRandomProductsMode) {
      const initialExclusions = [...excludeProductIds, currentProductId].filter(Boolean);
      seenIds.current = new Set(initialExclusions);
    }
    
    // Start fetching
    fetchPage(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSubCats.join('|'), singleVariantCode, singleCategoryCode, fetchPage, isRandomProductsMode]);

  /* ---------- Infinite‑scroll observer ---------- */
  useEffect(() => {
    if (!sentinelRef.current || !scrollRef.current) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !loadingMore
        ) {
          const next = skipRef.current + PAGE_SIZE;
          skipRef.current = next;
          fetchPage(next, false);
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, fetchPage]);

  /* ---------- Section title ---------- */
  const sectionTitle =
    (singleVariantCode || singleCategoryCode) && specCatName
      ? specCatName
      : 'Customers also bought';

  /* ─────────────────── Render ─────────────────── */
  // Don't render anything if we don't have the necessary parameters
  if (!singleVariantCode && !singleCategoryCode && (!effectiveSubCats || effectiveSubCats.length === 0)) {
    return null;
  }

  return (
    <TopBoughtContext.Provider
    value={{ singleCategoryCode, singleVariantCode, insertionDetails }}
    >
      <Box sx={{ width: '100%', px: 1 }}>
        {!hideHeading && (
          <>
            {(loadingInit && !isInitialized) && !specCatName ? (
              <Skeleton
                variant="text"
                width={200}
                height={32}
                sx={{ mb: 1 }}
              />
            ) : (
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                {sectionTitle}
              </Typography>
            )}
          </>
        )}

        {loadingInit && !isInitialized ? (
          <ScrollContainer>
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <ProductCardSkeleton key={`skel-${i}`} />
            ))}
          </ScrollContainer>
        ) : (
          <Fade in={isInitialized && products.length > 0}>
            <ScrollContainer ref={scrollRef}>
              {products.map((p, i) => (
                <ProductCard key={`${p._id}-${i}`} product={p} />
              ))}
              {loadingMore &&
                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <ProductCardSkeleton key={`load-${i}`} />
                ))}
              {hasMore && <Sentinel ref={sentinelRef} />}
            </ScrollContainer>
          </Fade>
        )}
        
        {/* Show message when no products are found and not loading */}
        {isInitialized && products.length === 0 && !loadingInit && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography variant="body2">
              No products found for this category.
            </Typography>
          </Box>
        )}
      </Box>
    </TopBoughtContext.Provider>
  );
}

/* ─────────────────── Cards ─────────────────── */
const ProductCard = memo(function ProductCard({ product }) {
  const router = useRouter();
  const { imageUrl, outOfStock } = getDisplayImage(product);

  const { insertionDetails, singleCategoryCode, singleVariantCode } =
    React.useContext(TopBoughtContext);

  const thumb = useMemo(
    () =>
      imageUrl.startsWith('/')
        ? `${baseImageUrl}${imageUrl}`
        : `${baseImageUrl}/${imageUrl}`,
    [imageUrl]
  );

  const cartPayload = useMemo(
    () => ({ ...product, thumbnail: thumb }),
    [product, thumb]
  );

  const showCategory = !singleCategoryCode && !singleVariantCode;

  return (
    <Card
      sx={cardSx}
      onClick={() =>
        router.push(`/shop/${product.pageSlug || ''}`)
      }
    >
      <CardMedia
        sx={{
          position: 'relative',
          pt: '75%',
          filter: outOfStock ? 'grayscale(100%)' : 'none',
        }}
      >
        <Image
          src={thumb}
          alt={product.name || 'product'}
          fill
          sizes="200px"
          style={{ objectFit: 'cover' }}
        />
      </CardMedia>
      <CardContent sx={{ pt: 1.5, pb: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontFamily: 'Jost', fontWeight: 500 }}
          noWrap
        >
          {product.name}
        </Typography>
        {showCategory && (
          <Typography
            variant="caption"
            sx={{ color: 'rgba(0,0,0,0.5)' }}
            noWrap
          >
            {product.category?.name || product.category}
          </Typography>
        )}
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, mt: 0.5 }}
        >
          ₹{product.price}
        </Typography>
        <AddToCartButton
          fullWidth
          product={cartPayload}
          onClick={(e) => e.stopPropagation()}
          insertionDetails={insertionDetails}
          enableVariantSelection
        />
      </CardContent>
    </Card>
  );
});

const ProductCardSkeleton = memo(function ProductCardSkeleton() {
  const { singleCategoryCode, singleVariantCode } =
    React.useContext(TopBoughtContext);
  const showCategory = !singleCategoryCode && !singleVariantCode;

  return (
    <Card sx={cardSx}>
      <Skeleton
        variant="rectangular"
        animation="wave"
        sx={{ pt: '75%' }}
      />
      <CardContent sx={{ pb: 2 }}>
        <Skeleton variant="text" width="80%" height={20} />
        {showCategory && (
          <Skeleton variant="text" width="60%" height={18} />
        )}
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton
          variant="rectangular"
          width="100%"
          height={36}
          sx={{ mt: 1 }}
        />
      </CardContent>
    </Card>
  );
});

/* ─────────────────── Memo optimisation ─────────────────── */
function propsAreEqual(prev, next) {
  const prevCats = Array.isArray(prev.subCategories)
    ? prev.subCategories.join('|')
    : '';
  const nextCats = Array.isArray(next.subCategories)
    ? next.subCategories.join('|')
    : '';
  return (
    prevCats === nextCats &&
    prev.currentProductId === next.currentProductId &&
    prev.singleVariantCode === next.singleVariantCode &&
    prev.singleCategoryCode === next.singleCategoryCode &&
    prev.excludeProductIds?.join('|') === next.excludeProductIds?.join('|') &&
    prev.pageType === next.pageType &&
    prev.hideHeading === next.hideHeading
  );
}

const TopBoughtProducts = memo(TopBoughtProductsBase, propsAreEqual);

export { TopBoughtProducts };
export default TopBoughtProducts;
