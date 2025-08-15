'use client';

import React, { useState, useEffect, useMemo, memo } from 'react';
import { Box, Typography, Card, CardContent, CardMedia } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AddToCartButton from '@/components/utils/AddToCartButton';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

/* ─────────────────── ULTRA-FAST STYLING ─────────────────── */
const ScrollContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  overflowX: 'auto',
  gap: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  scrollSnapType: 'x mandatory',
  '&::-webkit-scrollbar': { display: 'none' },
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
}));

const ProductCardStyled = styled(Card)({
  width: 200,
  minWidth: 200,
  flexShrink: 0,
  scrollSnapAlign: 'start',
  borderRadius: 12,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  cursor: 'pointer',
  '&:hover': { 
    transform: 'translateY(-4px)', 
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)' 
  },
});

const LoadingSkeleton = styled(Box)({
  width: 200,
  minWidth: 200,
  height: 280,
  borderRadius: 12,
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'loading 1.5s infinite',
  '@keyframes loading': {
    '0%': { backgroundPosition: '200% 0' },
    '100%': { backgroundPosition: '-200% 0' }
  }
});

/* ─────────────────── CACHE SYSTEM ─────────────────── */
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (subCategories, singleVariantCode, singleCategoryCode) => {
  if (singleCategoryCode) return `cat:${singleCategoryCode}`;
  if (singleVariantCode) return `var:${singleVariantCode}`;
  return `multi:${subCategories.sort().join(',')}`;
};

const getFromCache = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
  
  // Limit cache size
  if (cache.size > 50) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
};

/* ─────────────────── ULTRA-FAST FETCH ─────────────────── */
const fetchTopBoughtProducts = async (params) => {
  const cacheKey = getCacheKey(
    params.subCategories || [],
    params.singleVariantCode,
    params.singleCategoryCode
  );

  // Try cache first
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Prepare URL params
  const searchParams = new URLSearchParams();
  if (params.subCategories?.length) {
    searchParams.set('subCategories', params.subCategories.join(','));
  }
  if (params.singleVariantCode) {
    searchParams.set('singleVariantCode', params.singleVariantCode);
  }
  if (params.singleCategoryCode) {
    searchParams.set('singleCategoryCode', params.singleCategoryCode);
  }

  // Fast fetch with minimal options
  const response = await fetch(`/api/showcase/products/top-bought?${searchParams}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'force-cache' // Aggressive browser caching
  });

  if (!response.ok) throw new Error('Failed to fetch');
  
  const data = await response.json();
  
  // Cache the result
  setCache(cacheKey, data);
  
  return data;
};

/* ─────────────────── OPTIMIZED IMAGE HELPER ─────────────────── */
const getProductImage = (product) => {
  // Fast image selection
  if (product.options?.length > 0) {
    const withStock = product.options.find(o => 
      o.inventoryData?.availableQuantity > 0 && o.images?.length > 0
    );
    if (withStock) return withStock.images[0];
    
    const anyImage = product.options.find(o => o.images?.length > 0);
    if (anyImage) return anyImage.images[0];
  }
  
  return product.images?.[0] || '/images/assets/gifs/helmetloadinggif.gif';
};

/* ─────────────────── PRODUCT CARD COMPONENT ─────────────────── */
const ProductCard = memo(({ product, insertionDetails }) => {
  const router = useRouter();
  
  const imageUrl = useMemo(() => getProductImage(product), [product]);
  const fullImageUrl = useMemo(() => 
    imageUrl.startsWith('/') 
      ? `${baseImageUrl}${imageUrl}` 
      : `${baseImageUrl}/${imageUrl}`,
    [imageUrl]
  );
  
  const handleClick = () => {
    if (product.pageSlug) {
      router.push(`/shop/${product.pageSlug}`);
    }
  };

  return (
    <ProductCardStyled onClick={handleClick}>
      <CardMedia sx={{ position: 'relative', paddingTop: '75%' }}>
        <Image
          src={fullImageUrl}
          alt={product.name || 'Product'}
          fill
          sizes="200px"
          style={{ objectFit: 'cover', filter: 'none' }}
          loading="lazy"

        />
      </CardMedia>
      <CardContent sx={{ paddingTop: 1.5, paddingBottom: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{ 
            fontFamily: 'Jost', 
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {product.name}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, marginTop: 0.5 }}
        >
          ₹{product.price}
        </Typography>
        <AddToCartButton
          fullWidth
          product={{ ...product, thumbnail: fullImageUrl }}
          onClick={(e) => e.stopPropagation()}
          insertionDetails={insertionDetails}
        />
      </CardContent>
    </ProductCardStyled>
  );
});

ProductCard.displayName = 'ProductCard';

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
  const [categoryName, setCategoryName] = useState('');

  // Stable subcategories
  const effectiveSubCats = useMemo(() => {
    const subCatArr = Array.isArray(subCategories) ? subCategories : [];
    return subCatArr.length || singleVariantCode || singleCategoryCode
      ? subCatArr
      : ['Car Wraps', 'Car Care'];
  }, [subCategories, singleVariantCode, singleCategoryCode]);

  // Insertion details for analytics
  const insertionDetails = useMemo(() => ({
    component: 'topBoughtProducts',
    pageType: pageType
  }), [pageType]);

  // Section title
  const sectionTitle = useMemo(() => {
    if ((singleVariantCode || singleCategoryCode) && categoryName) {
      return categoryName;
    }
    return 'Customers also bought';
  }, [singleVariantCode, singleCategoryCode, categoryName]);

  // Stable keys for dependencies
  const subCategoriesKey = useMemo(() => effectiveSubCats.join('|'), [effectiveSubCats]);
  const excludeIdsKey = useMemo(() => excludeProductIds.join('|'), [excludeProductIds]);

  // Ultra-fast data fetching
  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      try {
        setLoading(true);
        
        const data = await fetchTopBoughtProducts({
          subCategories: effectiveSubCats,
          singleVariantCode,
          singleCategoryCode
        });

        if (!isMounted) return;

        let filteredProducts = data.products || [];
        
        // Client-side filtering only when necessary
        if (excludeProductIds.length > 0 || currentProductId) {
          const excludeSet = new Set([...excludeProductIds, currentProductId].filter(Boolean));
          filteredProducts = filteredProducts.filter(p => !excludeSet.has(p._id));
        }

        setProducts(filteredProducts.slice(0, 20)); // Limit for performance
        setCategoryName(data.specificCategoryName || '');
        
      } catch (error) {
        console.error('Failed to load top bought products:', error);
        if (isMounted) {
          setProducts([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [subCategoriesKey, singleVariantCode, singleCategoryCode, excludeIdsKey, currentProductId, effectiveSubCats, excludeProductIds]);

  // Don't render if no valid parameters
  if (!singleVariantCode && !singleCategoryCode && !effectiveSubCats.length) {
    return null;
  }

  return (
    <Box sx={{ width: '100%', paddingX: 1, maxWidth: 1200, margin: 'auto' }}>
      {!hideHeading && (
        <Typography 
          variant="h5" 
          sx={{ 
            marginBottom: 2, 
            fontWeight: 600,
            fontFamily: 'Jost'
          }}
        >
          {loading ? 'Loading...' : sectionTitle}
        </Typography>
      )}

      <ScrollContainer>
        {loading ? (
          // Fast loading skeletons
          Array.from({ length: 6 }).map((_, i) => (
            <LoadingSkeleton key={`skeleton-${i}`} />
          ))
        ) : products.length > 0 ? (
          // Render products
          products.map((product, index) => (
            <ProductCard
              key={`${product._id}-${index}`}
              product={product}
              insertionDetails={insertionDetails}
            />
          ))
        ) : (
          // No products message
          <Box sx={{ 
            textAlign: 'center', 
            padding: 4, 
            color: 'text.secondary',
            width: '100%'
          }}>
            <Typography variant="body2">
              No products found for this category.
            </Typography>
          </Box>
        )}
      </ScrollContainer>
    </Box>
  );
}

/* ─────────────────── MEMOIZATION ─────────────────── */
const TopBoughtProductsOptimized = memo(TopBoughtProductsUltraFast, (prevProps, nextProps) => {
  // Shallow comparison for performance
  return (
    prevProps.singleVariantCode === nextProps.singleVariantCode &&
    prevProps.singleCategoryCode === nextProps.singleCategoryCode &&
    prevProps.currentProductId === nextProps.currentProductId &&
    prevProps.pageType === nextProps.pageType &&
    prevProps.hideHeading === nextProps.hideHeading &&
    JSON.stringify(prevProps.subCategories) === JSON.stringify(nextProps.subCategories) &&
    JSON.stringify(prevProps.excludeProductIds) === JSON.stringify(nextProps.excludeProductIds)
  );
});

TopBoughtProductsOptimized.displayName = 'TopBoughtProductsOptimized';

export { TopBoughtProductsOptimized as TopBoughtProducts };
export default TopBoughtProductsOptimized;
