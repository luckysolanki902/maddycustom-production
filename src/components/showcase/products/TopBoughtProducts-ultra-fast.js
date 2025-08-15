'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { Box, Typography, Skeleton, Fade, Card, CardContent, CardMedia } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AddToCartButton from '@/components/utils/AddToCartButton';

/* ─────────────────── CONSTANTS ─────────────────── */
const BASE_IMAGE_URL = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
const PAGE_SIZE = 10;
const FETCH_TIMEOUT = 3000; // 3 second timeout

/* ─────────────────── CACHE LAYER ─────────────────── */
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (params) => {
  const { subCategories = [], singleVariantCode = '', singleCategoryCode = '' } = params;
  return `${subCategories.join('|')}::${singleVariantCode}::${singleCategoryCode}`;
};

const getCachedData = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCachedData = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
  // Limit cache size
  if (cache.size > 50) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
};

/* ─────────────────── OPTIMIZED FETCHER ─────────────────── */
const fetchWithTimeout = async (url, options, timeout = FETCH_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Cache-Control': 'max-age=300', // 5 minute client cache
        ...options?.headers
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

/* ─────────────────── STYLED COMPONENTS ─────────────────── */
const ScrollContainer = styled(Box)({
  display: 'flex',
  overflowX: 'auto',
  gap: '16px',
  paddingBottom: '24px',
  scrollSnapType: 'x proximity',
  '&::-webkit-scrollbar': { display: 'none' },
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
});

const ProductCardWrapper = styled(Card)({
  width: 200,
  flexShrink: 0,
  scrollSnapAlign: 'start',
  borderRadius: '12px',
  transition: 'transform 0.2s ease-out',
  cursor: 'pointer',
  '&:hover': { 
    transform: 'translateY(-4px)', 
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)' 
  },
});

/* ─────────────────── UTILITIES ─────────────────── */
const getOptimizedImage = (product) => {
  // Pre-select best option with inventory
  if (product.options?.length) {
    const inStock = product.options.find(o => 
      o.inventoryData?.availableQuantity > 0 && o.images?.length
    );
    if (inStock) {
      return { 
        imageUrl: inStock.images[0], 
        isAvailable: true,
        selectedOption: inStock 
      };
    }
    
    const firstWithImage = product.options.find(o => o.images?.length);
    if (firstWithImage) {
      return { 
        imageUrl: firstWithImage.images[0], 
        isAvailable: false,
        selectedOption: firstWithImage 
      };
    }
  }
  
  return {
    imageUrl: product.images?.[0] || '/images/assets/gifs/helmetloadinggif.gif',
    isAvailable: product.inventoryData?.availableQuantity > 0,
    selectedOption: null
  };
};

const formatImageUrl = (imageUrl) => {
  if (!imageUrl) return `${BASE_IMAGE_URL}/images/assets/gifs/helmetloadinggif.gif`;
  return imageUrl.startsWith('/') ? `${BASE_IMAGE_URL}${imageUrl}` : `${BASE_IMAGE_URL}/${imageUrl}`;
};

/* ─────────────────── CONTEXT ─────────────────── */
const TopBoughtContext = React.createContext();

/* ─────────────────── PRODUCT CARD ─────────────────── */
const ProductCard = memo(function ProductCard({ product }) {
  const router = useRouter();
  const { insertionDetails, showCategory } = React.useContext(TopBoughtContext);
  
  const productData = useMemo(() => {
    const imageData = getOptimizedImage(product);
    const optimizedProduct = {
      ...product,
      selectedOption: imageData.selectedOption
    };
    
    return {
      product: optimizedProduct,
      imageUrl: formatImageUrl(imageData.imageUrl),
      isAvailable: imageData.isAvailable,
      displayName: product.name,
      displayPrice: product.price,
      categoryName: product.category?.name || ''
    };
  }, [product]);

  const handleCardClick = useCallback(() => {
    if (productData.product.pageSlug) {
      router.push(`/shop/${productData.product.pageSlug}`);
    }
  }, [router, productData.product.pageSlug]);

  const handleAddToCart = useCallback((e) => {
    e.stopPropagation();
  }, []);

  return (
    <ProductCardWrapper onClick={handleCardClick}>
      <CardMedia sx={{ position: 'relative', paddingTop: '75%' }}>
        <Image
          src={productData.imageUrl}
          alt={productData.displayName}
          fill
          sizes="200px"
          style={{ 
            objectFit: 'cover',
            filter: productData.isAvailable ? 'none' : 'grayscale(0.3) opacity(0.8)'
          }}
          loading="lazy"
        />
      </CardMedia>
      <CardContent sx={{ padding: '12px 16px 16px' }}>
        <Typography
          variant="subtitle2"
          sx={{ 
            fontFamily: 'Jost', 
            fontWeight: 500,
            lineHeight: 1.2,
            marginBottom: showCategory ? '4px' : '8px'
          }}
          noWrap
        >
          {productData.displayName}
        </Typography>
        
        {showCategory && productData.categoryName && (
          <Typography
            variant="caption"
            sx={{ 
              color: 'rgba(0,0,0,0.6)',
              lineHeight: 1,
              marginBottom: '8px',
              display: 'block'
            }}
            noWrap
          >
            {productData.categoryName}
          </Typography>
        )}
        
        <Typography
          variant="body2"
          sx={{ 
            fontWeight: 600,
            marginBottom: '12px',
            color: '#424242'
          }}
        >
          ₹{productData.displayPrice}
        </Typography>
        
        <AddToCartButton
          fullWidth
          product={{ ...productData.product, thumbnail: productData.imageUrl }}
          onClick={handleAddToCart}
          insertionDetails={insertionDetails}
          size="small"
        />
      </CardContent>
    </ProductCardWrapper>
  );
});

/* ─────────────────── SKELETON ─────────────────── */
const ProductCardSkeleton = memo(function ProductCardSkeleton() {
  const { showCategory } = React.useContext(TopBoughtContext);
  
  return (
    <ProductCardWrapper>
      <Skeleton variant="rectangular" sx={{ paddingTop: '75%' }} animation="wave" />
      <CardContent sx={{ padding: '12px 16px 16px' }}>
        <Skeleton variant="text" width="85%" height={20} animation="wave" />
        {showCategory && (
          <Skeleton variant="text" width="65%" height={16} animation="wave" />
        )}
        <Skeleton variant="text" width="45%" height={20} animation="wave" />
        <Skeleton variant="rectangular" width="100%" height={32} sx={{ marginTop: '12px' }} animation="wave" />
      </CardContent>
    </ProductCardWrapper>
  );
});

/* ─────────────────── MAIN COMPONENT ─────────────────── */
function TopBoughtProductsUltraFast({
  subCategories = [],
  currentProductId = '',
  excludeProductIds = [],
  singleVariantCode = '',
  singleCategoryCode = '',
  pageType = '',
  hideHeading = false,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const abortControllerRef = useRef(null);

  // Memoized parameters
  const fetchParams = useMemo(() => {
    const effectiveSubCats = Array.isArray(subCategories) && subCategories.length > 0 
      ? subCategories 
      : ['Car Wraps', 'Car Care'];
    
    return {
      subCategories: effectiveSubCats,
      singleVariantCode: singleVariantCode.trim(),
      singleCategoryCode: singleCategoryCode.trim()
    };
  }, [subCategories, singleVariantCode, singleCategoryCode]);

  const insertionDetails = useMemo(() => ({
    component: 'topBoughtProducts',
    pageType
  }), [pageType]);

  const showCategory = !singleVariantCode && !singleCategoryCode;

  // Ultra-fast fetch function
  const fetchProducts = useCallback(async () => {
    const cacheKey = getCacheKey(fetchParams);
    
    // Try cache first (instant response)
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      setProducts(cachedData.products);
      setCategoryName(cachedData.categoryName);
      setLoading(false);
      setError(false);
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(false);

      const params = new URLSearchParams({ skip: '0' });
      if (fetchParams.subCategories.length) {
        params.set('subCategories', fetchParams.subCategories.join(','));
      }
      if (fetchParams.singleVariantCode) {
        params.set('singleVariantCode', fetchParams.singleVariantCode);
      }
      if (fetchParams.singleCategoryCode) {
        params.set('singleCategoryCode', fetchParams.singleCategoryCode);
      }

      const response = await fetchWithTimeout(
        `/api/showcase/products/top-bought?${params}`,
        {
          method: 'GET',
          signal: abortControllerRef.current.signal
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      let { products: fetchedProducts = [], specificCategoryName = '' } = data;

      // Client-side filtering for exclusions (ultra-fast)
      if (excludeProductIds.length || currentProductId) {
        const excludeSet = new Set([...excludeProductIds, currentProductId].filter(Boolean));
        fetchedProducts = fetchedProducts.filter(p => !excludeSet.has(p._id));
      }

      // Take first 10 for display
      const displayProducts = fetchedProducts.slice(0, PAGE_SIZE);

      // Cache the result
      setCachedData(cacheKey, {
        products: displayProducts,
        categoryName: specificCategoryName
      });

      setProducts(displayProducts);
      setCategoryName(specificCategoryName);
      setError(false);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('TopBoughtProducts fetch error:', err);
        setError(true);
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchParams, excludeProductIds, currentProductId]);

  // Effect for fetching
  useEffect(() => {
    fetchProducts();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchProducts]);

  // Determine section title
  const sectionTitle = useMemo(() => {
    if ((singleVariantCode || singleCategoryCode) && categoryName) {
      return categoryName;
    }
    return 'Customers also bought';
  }, [singleVariantCode, singleCategoryCode, categoryName]);

  // Don't render if no valid parameters
  if (!singleVariantCode && !singleCategoryCode && (!fetchParams.subCategories?.length)) {
    return null;
  }

  return (
    <TopBoughtContext.Provider value={{ insertionDetails, showCategory }}>
      <Box sx={{ width: '100%', paddingX: 1, maxWidth: 1400, margin: 'auto' }}>
        {!hideHeading && (
          <>
            {loading && !categoryName ? (
              <Skeleton variant="text" width={250} height={36} sx={{ marginBottom: 2 }} />
            ) : (
              <Typography 
                variant="h5" 
                sx={{ 
                  marginBottom: 2, 
                  fontWeight: 600,
                  fontFamily: 'Jost'
                }}
              >
                {sectionTitle}
              </Typography>
            )}
          </>
        )}

        {loading ? (
          <ScrollContainer>
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <ProductCardSkeleton key={`skeleton-${i}`} />
            ))}
          </ScrollContainer>
        ) : error ? (
          <Box sx={{ textAlign: 'center', padding: 4, color: 'text.secondary' }}>
            <Typography variant="body2">
              Unable to load products. Please try again.
            </Typography>
          </Box>
        ) : products.length === 0 ? (
          <Box sx={{ textAlign: 'center', padding: 4, color: 'text.secondary' }}>
            <Typography variant="body2">
              No products found for this category.
            </Typography>
          </Box>
        ) : (
          <Fade in={!loading} timeout={300}>
            <ScrollContainer>
              {products.map((product, index) => (
                <ProductCard 
                  key={`${product._id}-${index}`} 
                  product={product} 
                />
              ))}
            </ScrollContainer>
          </Fade>
        )}
      </Box>
    </TopBoughtContext.Provider>
  );
}

/* ─────────────────── MEMOIZATION ─────────────────── */
const propsAreEqual = (prevProps, nextProps) => {
  return (
    prevProps.singleVariantCode === nextProps.singleVariantCode &&
    prevProps.singleCategoryCode === nextProps.singleCategoryCode &&
    prevProps.currentProductId === nextProps.currentProductId &&
    prevProps.pageType === nextProps.pageType &&
    prevProps.hideHeading === nextProps.hideHeading &&
    JSON.stringify(prevProps.subCategories) === JSON.stringify(nextProps.subCategories) &&
    JSON.stringify(prevProps.excludeProductIds) === JSON.stringify(nextProps.excludeProductIds)
  );
};

const TopBoughtProducts = memo(TopBoughtProductsUltraFast, propsAreEqual);

export { TopBoughtProducts };
export default TopBoughtProducts;
