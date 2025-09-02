"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Drawer,
  Box,
  Typography,
  Card,
  CardMedia,
  CardContent,
  Button,
  IconButton,
  Skeleton,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { Close, ArrowForward, LocalOffer } from "@mui/icons-material";
import { closeRecommendationDrawer } from "@/store/slices/uiSlice";
import { setHasSeenVariantPopup, setPageSlug } from "@/store/slices/variantPreferenceSlice";
import AddToCartButton from "@/components/utils/AddToCartButton";
import { Dialog, DialogContent, Divider } from "@mui/material";
import { useRouter } from "next/navigation";
import Image from "next/image";

// Product Card Component with Coupon Information
const ProductCardWithCoupon = ({ product, categoryVariants }) => {
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart.items);
  const [unlockableCoupon, setUnlockableCoupon] = useState(null);
  const [loadingCoupon, setLoadingCoupon] = useState(false);

  // Handle card click to redirect to product page
  const handleCardClick = () => {
    if (product.pageSlug) {
      window.open(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/shop${product.pageSlug}`, '_blank');
    }
  };

  // Calculate current cart value
  const calculateCurrentCartValue = useCallback(() => {
    return cartItems.reduce((total, item) => {
      const price = item.price || item.productDetails?.price || 0;
      return total + price * item.quantity;
    }, 0);
  }, [cartItems]);

  // Fetch unlockable coupon for this specific product
  const fetchUnlockableCoupon = useCallback(async () => {
    const currentCartValue = calculateCurrentCartValue();
    const potentialCartValue = currentCartValue + (product.price || 0);

    if (potentialCartValue <= currentCartValue) return;

    setLoadingCoupon(true);
    try {
      const params = new URLSearchParams({
        cartValue: potentialCartValue.toString(),
        showCardOnly: "true",
      });

      const response = await fetch(`/api/checkout/bestcoupon?${params}`);
      const data = await response.json();

      if (data.bestOffer && data.shortfall === 0) {
        setUnlockableCoupon(data.bestOffer);
      } else {
        setUnlockableCoupon(null);
      }
    } catch (error) {
      console.error("Error fetching unlockable coupon:", error);
      setUnlockableCoupon(null);
    } finally {
      setLoadingCoupon(false);
    }
  }, [product.price, calculateCurrentCartValue]);

  // Fetch coupon when component mounts or cart changes
  useEffect(() => {
    fetchUnlockableCoupon();
  }, [fetchUnlockableCoupon]);

  // Build a safe image URL (avoid empty string that triggers Next Image preload warnings)
  const baseCdn = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || "";
  const rawImage = product?.images?.[0];
  let imageUrl = undefined;
  if (rawImage && typeof rawImage === 'string') {
    const cleaned = rawImage.trim();
    if (cleaned && cleaned !== '/' && cleaned.toLowerCase() !== 'null' && cleaned.toLowerCase() !== 'undefined') {
      imageUrl = cleaned.startsWith('http')
        ? cleaned
        : `${baseCdn}${cleaned.startsWith('/') ? cleaned : '/' + cleaned}`;
    }
  }
  // Fallback to an existing image asset if primary invalid
  if (!imageUrl) {
    imageUrl = '/images/off.jpg'; // this file exists in public/images
  }
  const discountPct = product.MRP && product.MRP > product.price
    ? Math.round(((product.MRP - product.price) / product.MRP) * 100)
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card
        onClick={handleCardClick}
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          p: 1.2,
          pr: 1.4,
          borderRadius: 3,
          overflow: 'hidden',
          background: 'linear-gradient(145deg,#ffffff,#fafafa)',
          border: '1px solid #ececec',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
          minHeight: { xs: 150, sm: 160 },
          transition: 'all .28s cubic-bezier(.4,.14,.3,1)',
          '&:hover': {
            boxShadow: '0 6px 18px -4px rgba(0,0,0,0.18)',
            transform: 'translateY(-4px)',
            borderColor: '#dcdcdc'
          }
        }}
      >
        {/* Image Wrapper */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: 108, sm: 120 },
            flexShrink: 0,
            borderRadius: 2,
            overflow: 'hidden',
            aspectRatio: '1/1',
            background: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            '& img': {
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform .5s ease',
            },
            '.MuiCard-root:hover & img': {
              transform: 'scale(1.05)'
            }
          }}
        >
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={product.name || 'Product'}
              fill
              sizes="(max-width: 600px) 40vw, 120px"
              style={{ objectFit: 'cover' }}
              priority={false}
            />
          )}
          {/* {discountPct && (
            <Box
              sx={{
                position: 'absolute',
                top: 6,
                left: 6,
                background: 'rgba(49,196,115,0.14)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(49,196,115,0.4)',
                color: '#139455',
                fontSize: '0.6rem',
                px: 0.65,
                py: 0.35,
                borderRadius: '10px',
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: .5,
              }}
            >
              {discountPct}% OFF
            </Box>
          )} */}
          {/* Removed old bottom overlay coupon tag; replaced with inline pill below price */}
        </Box>

        {/* Content anchored to bottom */}
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <Box sx={{ flexGrow: 1 }} /> {/* Top empty spacer */}
          <Box sx={{ pr: { xs: .5, sm: 1 }, display: 'flex', flexDirection: 'column', gap: .4, pb: .2 }}>
            <Typography
              component="h3"
              sx={{
                fontFamily: 'Jost, sans-serif',
                fontSize: { xs: '0.82rem', sm: '.9rem' },
                fontWeight: 600,
                color: '#1d1d1f',
                lineHeight: 1.25,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {product.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: .55 }}>
              <Typography sx={{ fontFamily: 'Jost, sans-serif', fontSize: { xs: '.95rem', sm: '1rem' }, fontWeight: 700, color: '#111' }}>
                ₹{product.price}
              </Typography>
              {product.MRP && product.MRP > product.price && (
                <>
                  <Typography sx={{ textDecoration: 'line-through', color: '#888', fontSize: '.63rem', fontFamily: 'Jost, sans-serif' }}>
                    ₹{product.MRP}
                  </Typography>
                  {discountPct && (
                    <Typography sx={{ color: '#139455', fontSize: '.6rem', fontWeight: 600, letterSpacing: .4 }}>
                      {discountPct}% off
                    </Typography>
                  )}
                </>
              )}
            </Box>
            {unlockableCoupon && !loadingCoupon && (
              <Box
                sx={{
                  display: 'inline-flex',
                  width: 'fit-content',
                  alignItems: 'center',
                  gap: .5,
                  px: 0.85,
                  py: 0.45,
                  mt: .1,
                  mb: .3,
                  background: 'linear-gradient(90deg, rgba(49,196,115,0.12), rgba(49,196,115,0.22))',
                  border: '1px solid rgba(49,196,115,0.45)',
                  borderRadius: '14px',
                  fontSize: '.55rem',
                  fontWeight: 600,
                  letterSpacing: .6,
                  color: '#0f6b3d',
                  textTransform: 'uppercase',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <LocalOffer sx={{ fontSize: 11, color: '#139455' }} />
                Add this to unlock ₹{unlockableCoupon.discountValue} OFF
              </Box>
            )}
            <Box sx={{ pt: .3 }}>
              <AddToCartButton
                product={product}
                enableVariantSelection
                hideRecommendationPopup
                size="small"
              />
            </Box>
          </Box>
        </Box>
      </Card>
    </motion.div>
  );
};

const RecommendationDrawer = () => {
  const dispatch = useDispatch();
  const { isRecommendationDrawerOpen, recommendationProduct } = useSelector(state => state.ui);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRecommendedProducts = useCallback(
    async designGroupId => {
      setLoading(true);
      try {
        const response = await fetch(`/api/products/by-design-group/${designGroupId}`);
        const data = await response.json();

        if (data.success) {
          // Filter out the current product and limit to 6 products total
          const filtered = data.products.filter(product => product._id !== recommendationProduct._id).slice(0, 6);
          setRecommendedProducts(filtered);
        }
      } catch (error) {
        console.error("Error fetching recommended products:", error);
      } finally {
        setLoading(false);
      }
    },
    [recommendationProduct]
  );

  useEffect(() => {
    if (isRecommendationDrawerOpen && recommendationProduct?.designGroupId) {
      fetchRecommendedProducts(recommendationProduct.designGroupId);
    }
  }, [isRecommendationDrawerOpen, recommendationProduct, fetchRecommendedProducts]);

  const handleClose = () => {
    dispatch(closeRecommendationDrawer());
    setRecommendedProducts([]);
  };

  const handleViewCart = () => {
    handleClose();
    window.location.href = "/viewcart";
  };

  const calculateDrawerHeight = () => {
    const headerHeight = 120; // Header section
    const footerHeight = 80; // Footer section
    const productsPerRow = window.innerWidth <= 600 ? 1 : 2;
    const rows = Math.ceil(recommendedProducts.length / productsPerRow);
    const productHeight = window.innerWidth <= 600 ? 180 : 160; // Slightly less height on PC
    const contentPadding = 48; // Top and bottom padding
    const spacing = rows > 1 ? (rows - 1) * 16 : 0; // Grid spacing between rows

    const totalHeight = headerHeight + footerHeight + contentPadding + rows * productHeight + spacing;

    // On mobile, allow more height, on PC be more conservative
    const maxHeight = window.innerWidth <= 600 ? window.innerHeight * 0.8 : window.innerHeight * 0.6;

    return Math.min(totalHeight, maxHeight);
  };

  const ProductSkeleton = () => (
    <Card
      sx={{
        height: 160,
        border: "1px solid #f0f0f0",
        boxShadow: "none",
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: "flex", height: "100%" }}>
        <Skeleton variant="rectangular" width={120} height="100%" />
        <CardContent sx={{ flex: 1, p: 2 }}>
          <Skeleton variant="text" width="80%" height={20} />
          <Skeleton variant="text" width="60%" height={16} sx={{ mt: 1 }} />
          <Skeleton variant="rectangular" width="100%" height={32} sx={{ mt: 2 }} />
        </CardContent>
      </Box>
    </Card>
  );

  return (
    <Drawer
      anchor="bottom"
      open={isRecommendationDrawerOpen}
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          backgroundColor: "#ffffff",
          height: "auto",
          maxHeight: "85vh",
        },
      }}
    >
      <AnimatePresence>
        {isRecommendationDrawerOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Box
              sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                minHeight: typeof window !== 'undefined' && window.innerWidth <= 600 ? "60vh" : "40vh",
                maxHeight: "85vh",
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  p: 3,
                  pb: 2,
                  borderBottom: "1px solid #f0f0f0",
                  position: "relative",
                }}
              >
                <IconButton
                  onClick={handleClose}
                  sx={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    color: "#666",
                    "&:hover": {
                      backgroundColor: "#f5f5f5",
                    },
                  }}
                >
                  <Close />
                </IconButton>

                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: "#2d2d2d",
                    mb: 1,
                    pr: 6,
                    fontFamily: "Jost, sans-serif",
                  }}
                >
                  Matching Picks
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "#666",
                    lineHeight: 1.5,
                    fontFamily: "Jost, sans-serif",
                  }}
                >
                  Customers who bought this also loved these matching designs
                </Typography>
              </Box>

              {/* Content */}
              <Box
                sx={{
                  p: 3,
                  flex: "1",
                  overflowY: "auto",
                  minHeight: 0, // Important for flex child with overflow
                }}
              >
                {loading ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, 1fr)",
                      },
                      gap: 2,
                    }}
                  >
                    {[1, 2, 3, 4].map(index => (
                      <ProductSkeleton key={index} />
                    ))}
                  </Box>
                ) : recommendedProducts.length > 0 ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, 1fr)",
                      },
                      gap: 2,
                    }}
                  >
                    {recommendedProducts.map(product => (
                      <ProductCardWithCoupon key={product._id} product={product} />
                    ))}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 4,
                      color: "#666",
                    }}
                  >
                    <Typography variant="body2">No matching products found</Typography>
                  </Box>
                )}
              </Box>

              {/* Fixed Footer */}
              <Box
                sx={{
                  position: "sticky",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "#ffffff",
                  borderTop: "1px solid #f0f0f0",
                  p: 1,
                  zIndex: 1300,
                  mt: "auto",
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 2,
                  }}
                >
                  <Button
                    variant="text"
                    fullWidth
                    onClick={handleClose}
                    sx={{
                      color: "#2d2d2d",
                      py: 1,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      // minHeight: 48,
                      "&:hover": {
                        backgroundColor: "#f8f8f8",
                      },
                      fontFamily: "Jost, sans-serif",
                    }}
                  >
                    Continue Shopping
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleViewCart}
                    endIcon={<ArrowForward />}
                    sx={{
                      backgroundColor: "#2d2d2d",
                      py: 1,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      // minHeight: 48,
                      "&:hover": {
                        backgroundColor: "#1a1a1a",
                      },
                      fontFamily: "Jost, sans-serif",
                    }}
                  >
                    View Cart
                  </Button>
                </Box>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Drawer>
  );
};

export default RecommendationDrawer;
