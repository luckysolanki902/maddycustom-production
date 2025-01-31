'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
// MUI Imports
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
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
    /* Hide scrollbar for Chrome, Safari and Opera */
    '&::-webkit-scrollbar': {
        display: 'none',
    },
    /* Hide scrollbar for IE, Edge and Firefox */
    '-ms-overflow-style': 'none', // IE and Edge
    'scrollbar-width': 'none', // Firefox
}));

export const TopBoughtProducts = ({ subCategories, currentProductId }) => {
    const [products, setProducts] = useState([]);
    const [skip, setSkip] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true); // For initial load
    const [loadingMore, setLoadingMore] = useState(false); // For loading more

    // Fetch data function
    const fetchProducts = useCallback(async (newSkip = 0) => {
        try {
            if (newSkip === 0) {
                setInitialLoading(true);
            } else {
                setLoadingMore(true);
            }

            // API call
            const { data } = await axios.get('/api/showcase/products/top-bought', {
                params: {
                    subCategories: subCategories.join(','), // Send as comma-separated string
                    currentProductId,
                    skip: newSkip,
                },
            });

            const { products: fetched, hasMore: more } = data;

            if (newSkip === 0) {
                // Fresh load
                setProducts(fetched);
            } else {
                // Append
                setProducts(prev => [...prev, ...fetched]);
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
    }, [subCategories, currentProductId]);

    useEffect(() => {
        // On mount or when subCategories/currentProductId changes, reset and fetch
        setSkip(0);
        setProducts([]); // Clear previous products
        fetchProducts(0);
    }, [fetchProducts]);

    const handleLoadMore = () => {
        const newSkip = skip + 10; // Assuming PAGE_SIZE is 10
        setSkip(newSkip);
        fetchProducts(newSkip);
    };

    return (
        <Box sx={{ width: '100%', mt: 3, p: 2 }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Customers also bought
            </Typography>

            {initialLoading ? (
                // Show skeletons on initial load without Fade
                <ScrollContainer>
                    {Array.from(new Array(10)).map((_, index) => (
                        <ProductCardSkeleton key={index} />
                    ))}
                </ScrollContainer>
            ) : (
                // Fade in the actual content once loading is complete
                <Fade in={!initialLoading}>
                    <ScrollContainer>
                        {products.map((prod) => (
                            <ProductCard key={prod._id} product={prod} />
                        ))}

                        {/* Show skeletons instead of "Load More" when loading more */}
                        {loadingMore ? (
                            Array.from(new Array(10)).map((_, index) => (
                                <ProductCardSkeleton key={`skeleton-${index}`} />
                            ))
                        ) : (
                            // Show "Load More" as the last card if hasMore is true
                            hasMore && (
                                <LoadMoreCard onClick={handleLoadMore} loading={loadingMore} />
                            )
                        )}
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
                width: 200, // Fixed width to match skeleton
                border: '1px solid #ddd',
                p: 0,
                pt: '1rem',
                flexShrink: 0, // Prevent shrinking in horizontal scroll
                cursor: 'pointer',
                ':hover': {
                    boxShadow: 4,
                },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: 300,
            }}
            onClick={() => {
                // Navigate to product URL
                window.location.href = productUrl;
            }}
        >
            {/* Product Image */}
            <Box
                sx={{
                    position: 'relative',
                    width: '100%',
                    height: 'auto',
                    mb: 1,
                    aspectRatio: '1.617523'
                }}
            >
                {product.images && product.images[0] ? (
                    <Image
                        src={`${baseImageUrl}${product.images[0]}`}
                        style={{ boxShadow: '0px 3px 6px rgba(0,0,0,0.36)' }}
                        alt={product.name || 'product'}
                        fill
                    />
                ) : (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            bgcolor: '#f0f0f0',
                        }}
                    />
                )}
            </Box>

            {/* Product Info */}
            <Box sx={{ flexGrow: 1, mx: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 500, overflow: 'hidden', fontFamily: 'Jost', color: 'rgba(0, 0, 0, 0.5)' }}>
                    {product.name}
                </Typography>
                {/* Specific Category Variant Name */}
                {scvName && (
                    <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', fontFamily: 'Jost', color: 'rgba(0, 0, 0, 1)' }}>
                        {scvName}
                    </Typography>
                )}
                {/* Product Price */}
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'rgba(0, 0, 0, 0.5)', fontSize: '1.4rem', mr: 0.5 }}>
                        ₹
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'rgba(0, 0, 0, 0.5)', fontWeight: '600' }}>
                        {product.price}
                    </Typography>
                </Box>
                {/* Order Icon */}
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
                width: 200, // Fixed width to match ProductCard
                border: '2px dashed #aaa',
                p: 2,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                ':hover': {
                    borderColor: '#555',
                },
                backgroundColor: '#fafafa',
                height: 300, // Fixed height to match ProductCard
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
                p: 1,
            }}
        >
            {/* Image Skeleton */}
            <Skeleton
                variant="rectangular"
                sx={{
                    width: '100%',
                    height: 'auto', // Adjust height as needed
                    mb: 1,
                    aspectRatio: '1.617523',
                }}
            />

            {/* Text Skeletons */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Skeleton variant="text" width="80%" height={20} />
                <Skeleton variant="text" width="80%" height={20} />
                <Skeleton variant="text" width="60%" height={20} />
                <Skeleton variant="text" width="60%" height={20} />
                <Skeleton variant="text" width="40%" height={20} />
                <Skeleton variant="text" width="40%" height={20} />
            </Box>
        </Box>
    );
}
