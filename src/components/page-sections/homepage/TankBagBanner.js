'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Card, CardMedia, CardContent, Skeleton } from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
const TANK_BAG_VARIANT_ID = '69685c7c1f68d6f0791151b6';
const PAGE_SIZE = 10;

const TankBagBanner = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const router = useRouter();
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);

  // Fetch products with pagination
  const fetchProducts = useCallback(async (currentSkip, isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = await fetch(
        `/api/products/by-variant?variantId=${TANK_BAG_VARIANT_ID}&limit=${PAGE_SIZE}&skip=${currentSkip}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const newProducts = data.products || [];
        
        if (isInitial) {
          setProducts(newProducts);
        } else {
          setProducts(prev => [...prev, ...newProducts]);
        }
        
        setHasMore(data.hasMore || false);
        setSkip(currentSkip + newProducts.length);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, []);

  // Initial load: check variant and fetch first page
  useEffect(() => {
    const checkVariantAndFetchProducts = async () => {
      try {
        const variantResponse = await fetch(
          `/api/variants/check-availability?variantId=${TANK_BAG_VARIANT_ID}`
        );
        
        if (!variantResponse.ok) {
          setIsAvailable(false);
          setLoading(false);
          return;
        }

        const variantData = await variantResponse.json();
        
        if (!variantData.available) {
          setIsAvailable(false);
          setLoading(false);
          return;
        }

        setIsAvailable(true);
        await fetchProducts(0, true);
      } catch (error) {
        console.error('Error checking tank bag availability:', error);
        setIsAvailable(false);
        setLoading(false);
      }
    };

    checkVariantAndFetchProducts();
  }, [fetchProducts]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !scrollRef.current || !hasMore || loadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchProducts(skip);
        }
      },
      {
        root: scrollRef.current,
        threshold: 0.1,
      }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [hasMore, loadingMore, skip, fetchProducts]);

  // Don't render anything if loading or not available
  if (loading || !isAvailable) {
    return null;
  }

  const getDisplayImage = (product) => {
    if (product.options?.length) {
      const inStock = product.options.find(
        (o) => o.inventoryData?.availableQuantity > 0 && o.images?.length
      );
      if (inStock) return { imageUrl: inStock.images[0], outOfStock: false };

      const first = product.options.find((o) => o.images?.length);
      if (first) return { imageUrl: first.images[0], outOfStock: true };
    }
    if (product.images?.length) {
      return {
        imageUrl: product.images[0],
        outOfStock: product.inventoryData?.availableQuantity <= 0,
      };
    }
    return {
      imageUrl: '/images/assets/gifs/helmetloadinggif.gif',
      outOfStock: true,
    };
  };

  return (
    <Box
      sx={{
        width: '100%',
        mb: 4,
        mt: 10,
      }}
    >
      {/* Full-width Banner */}
      <Link href="/shop/accessories/bike-accessories/tank-bags/standard" style={{ textDecoration: 'none' }}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: { xs: '200px', sm: '300px', md: '400px' },
            cursor: 'pointer',
            overflow: 'hidden',
            borderRadius: '12px',
            mb: 3,
            '&:hover': {
              '& img': {
                transform: 'scale(1.05)',
              },
            },
          }}
        >
          {/* Mobile Image */}
          <Box
            sx={{
              display: { xs: 'block', md: 'none' },
              position: 'relative',
              width: '100%',
              height: '100%',
            }}
          >
            <Image
              src="/images/assets/cards/tank_bag_mobile.jpg"
              alt="Tank Bags"
              fill
              priority
              sizes="100vw"
              style={{
                objectFit: 'cover',
                transition: 'transform 0.3s ease-in-out',
              }}
            />
          </Box>
          {/* Desktop Image */}
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'relative',
              width: '100%',
              height: '100%',
            }}
          >
            <Image
              src="/images/assets/cards/tank_bag_pc.jpg"
              alt="Tank Bags"
              fill
              priority
              sizes="100vw"
              style={{
                objectFit: 'cover',
                transition: 'transform 0.3s ease-in-out',
              }}
            />
          </Box>
        </Box>
      </Link>

      {/* Product Cards - Only if we have products */}
      {products.length > 0 && (
        <Box
          ref={scrollRef}
          sx={{
            display: 'flex',
            overflowX: 'auto',
            gap: 2,
            pb: 2,
            scrollSnapType: 'x proximity',
            '&::-webkit-scrollbar': { display: 'none' },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          {products.map((product) => {
            const { imageUrl, outOfStock } = getDisplayImage(product);
            
            // Ensure thumbnail is never empty
            let thumbnail = imageUrl || '/images/assets/gifs/helmetloadinggif.gif';
            if (baseImageUrl && thumbnail) {
              thumbnail = thumbnail.startsWith('/')
                ? `${baseImageUrl}${thumbnail}`
                : `${baseImageUrl}/${thumbnail}`;
            }

            return (
              <Card
                key={product._id}
                onClick={() => router.push(`/shop/${product.pageSlug || ''}`)}
                sx={{
                  minWidth: 200,
                  maxWidth: 200,
                  flexShrink: 0,
                  scrollSnapAlign: 'start',
                  borderRadius: '16px',
                  transition: 'transform .2s, box-shadow .2s',
                  cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                  border: '1px solid rgba(0,0,0,0.04)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  },
                }}
              >
                <CardMedia
                  sx={{
                    position: 'relative',
                    pt: '75%',
                    filter: outOfStock ? 'grayscale(100%)' : 'none',
                  }}
                >
                  <Image
                    src={thumbnail}
                    alt={product.name || 'Tank Bag'}
                    fill
                    sizes="200px"
                    style={{ objectFit: 'cover' }}
                  />
                </CardMedia>
                <CardContent sx={{ pt: 1.5, pb: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontFamily: 'Jost',
                      fontWeight: 500,
                      mb: 0.5,
                    }}
                    noWrap
                  >
                    {product.name}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      ₹{product.price}
                    </Typography>
                    {product.MRP && product.MRP > product.price && (
                      <>
                        <Typography
                          variant="caption"
                          sx={{
                            textDecoration: 'line-through',
                            color: 'text.secondary',
                            fontWeight: 400,
                          }}
                        >
                          ₹{product.MRP}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'success.main',
                            fontWeight: 600,
                          }}
                        >
                          {Math.round(((product.MRP - product.price) / product.MRP) * 100)}% off
                        </Typography>
                      </>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
          
          {/* Loading skeleton for more products */}
          {loadingMore && Array.from({ length: 3 }).map((_, i) => (
            <Box
              key={`skeleton-${i}`}
              sx={{
                minWidth: 200,
                maxWidth: 200,
                flexShrink: 0,
              }}
            >
              <Skeleton variant="rectangular" width={200} height={150} sx={{ borderRadius: '16px' }} />
              <Skeleton variant="text" width="80%" sx={{ mt: 1 }} />
              <Skeleton variant="text" width="60%" />
            </Box>
          ))}
          
          {/* Sentinel element for infinite scroll */}
          {hasMore && <div ref={sentinelRef} style={{ width: 1, height: 1 }} />}
        </Box>
      )}
    </Box>
  );
};

export default TankBagBanner;
