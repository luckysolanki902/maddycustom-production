'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Fade from '@mui/material/Fade';
import { styled } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import AddToCartButton from '@/components/utils/AddToCartButton';
import Image from 'next/image';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

// Styled container to hide scrollbar.
const ScrollContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  overflowX: 'auto',
  gap: theme.spacing(2),
  paddingBottom: theme.spacing(2),
  '&::-webkit-scrollbar': { display: 'none' },
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
}));

export const TopBoughtProducts = ({
  subCategories = [],
  currentProductId = '',
  excludeProductIds = [],
}) => {
  if (subCategories.length === 0) {
    subCategories = ['Car Wraps', 'Car Care'];
  }
  const PAGE_SIZE = 10;
  const [products, setProducts] = useState([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const mergedExcludes = useRef([]);

  useEffect(() => {
    const initialExcludesSet = new Set(excludeProductIds.filter(Boolean));
    if (currentProductId) {
      initialExcludesSet.add(currentProductId);
    }
    mergedExcludes.current = [...initialExcludesSet];
    setSkip(0);
    setProducts([]);
    setHasMore(false);
    setInitialLoading(true);
    fetchProducts(0, [...initialExcludesSet]);
  }, []);

  const fetchProducts = useCallback(
    async (newSkip, excludes) => {
      try {
        if (newSkip === 0) {
          setInitialLoading(true);
        } else {
          setLoadingMore(true);
        }
        const { data } = await axios.get('/api/showcase/products/top-bought', {
          params: {
            subCategories: subCategories.join(','),
            currentProductId,
            skip: newSkip,
            excludeProductIds: excludes.join(','),
          },
        });
        const { products: fetched, hasMore: more } = data || {};
  
        // Map through fetched products and add selectedOption if options exist
        const updatedFetched = fetched.map((product) =>
          Array.isArray(product.options) && product.options.length > 0
            ? { ...product, selectedOption: product.options[0] }
            : product
        );
  
        if (newSkip === 0) {
          setProducts(updatedFetched);
          mergedExcludes.current.push(...updatedFetched.map((p) => p._id));
        } else {
          setProducts((prev) => [...prev, ...updatedFetched]);
          mergedExcludes.current.push(...updatedFetched.map((p) => p._id));
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
    },
    [subCategories, currentProductId, excludeProductIds]
  );
  

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
            {products.map((prod) => (
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

// Helper: decide which image to show based on product options.
const getDisplayImage = (product) => {
  // 1. If product has options with images, try to pick one with available inventory.
  if (product.options && product.options.length > 0) {
    for (const option of product.options) {
      if (option.images && option.images.length > 0) {
        if (option.inventoryData && option.inventoryData.availableQuantity > 0) {
          return { imageUrl: option.images[0], outOfStock: false };
        }
      }
    }
    // 2. Fallback: use first option image (mark as out-of-stock).
    for (const option of product.options) {
      if (option.images && option.images.length > 0) {
        return { imageUrl: option.images[0], outOfStock: true };
      }
    }
  }
  // 3. Otherwise, use product.images (and check product inventory if available).
  if (product.images && product.images[0]) {
    if (product.inventoryData && product.inventoryData.availableQuantity <= 0) {
      return { imageUrl: product.images[0], outOfStock: true };
    }
    return { imageUrl: product.images[0], outOfStock: false };
  }
  // 4. Final fallback placeholder.
  return { imageUrl: '/images/assets/gifs/helmetloadinggif.gif', outOfStock: true };
};

function ProductCard({ product }) {
  const router = useRouter();
  const productUrl = `/shop/${product.pageSlug || ''}`;
  const goToProductPage = () => {
    router.push(productUrl);
  };

  const { imageUrl, outOfStock } = getDisplayImage(product);
  const thumbnail = imageUrl ;

  return (
    <Box
      sx={{
        minWidth: 200,
        width: 200,
        border:'1px solid rgba(84, 84, 84,1)',
        backgroundColor: '#fff',
        pt: '1rem',
        flexShrink: 0,
        cursor: 'pointer',
        ':hover': { boxShadow: 4 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: 300,
      }}
      onClick={goToProductPage}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          mb: 1,
          aspectRatio: '1.617523',
        }}
      >
        {imageUrl ? (
          <Image
          width={500}
          height={500}
            src={
              imageUrl.startsWith('/')
                ? `${baseImageUrl}${imageUrl}`
                : `${baseImageUrl}/${imageUrl}`
            }
            alt={product.name || 'product'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              boxShadow: '0px 3px 6px rgba(0,0,0,0.36)',
              filter: outOfStock ? 'grayscale(100%)' : 'none',
              aspectRatio:'1.617',
            }}
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
        {product?.category?.name && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ overflow: 'hidden', fontFamily: 'Jost', color: 'rgba(0, 0, 0, 1)' }}
          >
            {product.category.name}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
          <Typography variant="body2" sx={{ color: 'rgba(0, 0, 0, 0.5)', fontSize: '1.4rem', mr: 0.5 }}>
            ₹
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(0, 0, 0, 0.5)', fontWeight: '600' }}>
            {product.price}
          </Typography>
        </Box>
        <Box
          sx={{ mt: 1 }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {/* {console.log(product.images[0],"image url")} */}

          <AddToCartButton product={{...product,thumbnail }} />
        </Box>
      </Box>
    </Box>
  );
}

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

function ProductCardSkeleton() {
  return (
    <Box
      sx={{
        width: 200,
        height: 300,
        border: '1px solid #ddd',
        backgroundColor: '#fff',
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1 }}>
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
