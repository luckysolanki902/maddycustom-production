'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Fade from '@mui/material/Fade';
import Image from 'next/image';
import { styled } from '@mui/material/styles';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

// Styled Scroll Container to hide scrollbar
const ScrollContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  overflowX: 'auto',
  gap: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  '&::-webkit-scrollbar': { display: 'none' },
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
}));

/**
 * TopBoughtProducts
 * @param {string[]} subCategories - sub-categories to fetch from
 * @param {string} currentProductId - ID of current product to exclude
 * @param {string[]} excludeProductIds - Additional product IDs to exclude
 */
export const TopBoughtProducts = ({
  subCategories = [],
  currentProductId = '',
  excludeProductIds = [],
}) => {
  const PAGE_SIZE = 10;
  const [products, setProducts] = useState([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Combine the exclude IDs once (including currentProductId, if needed).
  // If your parent is re-rendering on every tick, you might want to use useMemo here.
  const mergedExcludes = useRef([]);

  // On mount or prop change: build the initial exclude list.
  useEffect(() => {
    const initialExcludesSet = new Set(excludeProductIds.filter(Boolean));
    if (currentProductId) {
      initialExcludesSet.add(currentProductId);
    }
    mergedExcludes.current = [...initialExcludesSet];
    // Reset skip and products.
    setSkip(0);
    setProducts([]);
    setHasMore(false);
    setInitialLoading(true);

    // Fire the fetch with skip=0
    fetchProducts(0, [...initialExcludesSet]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subCategories]); 
  /**
   * We only re-run when subCategories changes in a meaningful way.
   * If you also want to re-run when currentProductId or excludeProductIds changes,
   * add them here. But watch out for repeated re-renders if they constantly change.
   */

  const fetchProducts = useCallback(async (newSkip, excludes) => {
    try {
      if (newSkip === 0) {
        setInitialLoading(true);
      } else {
        setLoadingMore(true);
      }

      const { data } = await axios.get('/api/showcase/products/top-bought', {
        params: {
          subCategories: subCategories.join(','),
          currentProductId: '', // Already included in excludes
          skip: newSkip,
          excludeProductIds: excludes.join(','), // pass as CSV
        },
      });

      const { products: fetched, hasMore: more } = data;

      if (newSkip === 0) {
        setProducts(fetched);
        // add them to the excludes
        mergedExcludes.current.push(...fetched.map(p => p._id));
      } else {
        setProducts(prev => [...prev, ...fetched]);
        mergedExcludes.current.push(...fetched.map(p => p._id));
      }
      setHasMore(more);
    } catch (err) {
      console.error('Error fetching top-bought products:', err);
    } finally {
      if (newSkip === 0) {
        setInitialLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [subCategories]);

  const handleLoadMore = () => {
    const newSkip = skip + PAGE_SIZE;
    setSkip(newSkip);
    fetchProducts(newSkip, mergedExcludes.current);
  };

  return (
    <Box sx={{ width: '100%', mt: 3, p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Customers also bought
      </Typography>

      {initialLoading ? (
        <ScrollContainer>
          {Array.from(new Array(PAGE_SIZE)).map((_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </ScrollContainer>
      ) : (
        <Fade in={!initialLoading}>
          <ScrollContainer>
            {products.map(prod => (
              <ProductCard key={prod._id} product={prod} />
            ))}
            {loadingMore
              ? Array.from(new Array(PAGE_SIZE)).map((_, index) => (
                  <ProductCardSkeleton key={`skeleton-${index}`} />
                ))
              : hasMore && <LoadMoreCard onClick={handleLoadMore} loading={loadingMore} />}
          </ScrollContainer>
        </Fade>
      )}
    </Box>
  );
};

// Product Card Component
function ProductCard({ product }) {
  const productUrl = `/shop/${product.pageSlug || ''}`;
  const scvName = product?.specificCategoryName || '';

  return (
    <Box
      sx={{
        minWidth: 200,
        width: 200,
        border: '1px solid #ddd',
        pt: '1rem',
        flexShrink: 0,
        cursor: 'pointer',
        ':hover': { boxShadow: 4 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: 300,
      }}
      onClick={() => {
        window.location.href = productUrl;
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          mb: 1,
          aspectRatio: '1.617523',
        }}
      >
        {product.images && product.images[0] ? (
          <Image
            src={`${baseImageUrl}${
              product.images[0].startsWith('/') ? product.images[0] : '/' + product.images[0]
            }`}
            style={{ boxShadow: '0px 3px 6px rgba(0,0,0,0.36)' }}
            alt={product.name || 'product'}
            fill
          />
        ) : (
          <Box sx={{ width: '100%', height: '100%', bgcolor: '#f0f0f0' }} />
        )}
      </Box>
      <Box sx={{ flexGrow: 1, mx: 1 }}>
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 500, overflow: 'hidden', fontFamily: 'Jost', color: 'rgba(0, 0, 0, 0.5)' }}
        >
          {product.name}
        </Typography>
        {scvName && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ overflow: 'hidden', fontFamily: 'Jost', color: 'rgba(0, 0, 0, 1)' }}
          >
            {scvName}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
          <Typography
            variant="body2"
            sx={{ color: 'rgba(0, 0, 0, 0.5)', fontSize: '1.4rem', mr: 0.5 }}
          >
            ₹
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(0, 0, 0, 0.5)', fontWeight: '600' }}>
            {product.price}
          </Typography>
        </Box>
        <Image
          style={{ width: '80px', height: 'auto', opacity: '0.8' }}
          width={250}
          height={125}
          src={`${baseImageUrl}/assets/icons/order.png`}
          alt=""
          priority
        />
      </Box>
    </Box>
  );
}

// Load More Card Component
function LoadMoreCard({ onClick, loading }) {
  return (
    <Box
      sx={{
        minWidth: 200,
        width: 200,
        border: '2px dashed #aaa',
        p: 2,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        ':hover': { borderColor: '#555' },
        backgroundColor: '#fafafa',
        height: 300,
      }}
      onClick={onClick}
    >
      {loading ? (
        <Skeleton variant="text" width="60%" height={24} />
      ) : (
        <Typography variant="button" color="text.secondary">
          Load More
        </Typography>
      )}
    </Box>
  );
}

// Product Card Skeleton Component
function ProductCardSkeleton() {
  return (
    <Box
      sx={{
        width: 200,
        height: 300,
        border: '1px solid #ddd',
        pt: '1rem',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        py: 1,
      }}
    >
      <Skeleton
        variant="rectangular"
        sx={{
          width: '100%',
          height: '100%',
          my: 1,
          aspectRatio: '1.617523',
        }}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px:1 }}>
        <Skeleton variant="text" width="80%" height={20} />
        <Skeleton variant="text" width="60%" height={20} />
        <Skeleton variant="text" width="60%" height={20} />
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton variant="text" width="40%" height={20} />
      </Box>
    </Box>
  );
}

export default TopBoughtProducts;
