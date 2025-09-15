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
import { Close, ArrowForward, LocalOffer, AutoAwesome } from "@mui/icons-material";
import { closeRecommendationDrawer, resetRecommendationCooldown } from "@/store/slices/uiSlice";
import { setHasSeenVariantPopup, setPageSlug } from "@/store/slices/variantPreferenceSlice";
import AddToCartButton from "@/components/utils/AddToCartButton";
import { Dialog, DialogContent, Divider } from "@mui/material";
import { useRouter } from "next/navigation";
import Image from "next/image";
import usePageType from "@/hooks/usePageType";

// Product Card Component with Coupon Information
const ProductCardWithCoupon = ({ product, categoryVariants }) => {
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart.items);
  const [unlockableCoupon, setUnlockableCoupon] = useState(null);
  const [loadingCoupon, setLoadingCoupon] = useState(false);
  // Use variants cache only; do not fetch here
  const variantsCache = useSelector(state => state.variants.cache);
  const cacheTimestamps = useSelector(state => state.variants.lastUpdated);
  const [hasVariants, setHasVariants] = useState(null); // null until cache arrives
  const pageType = usePageType();
  const insertionDetails = {
    component: "recommendation-drawer",
    pageType: pageType,
  };

  useEffect(() => {
    const categoryId = product?.specificCategory || product?.category?._id;
    if (!categoryId) {
      setHasVariants(false);
      return;
    }
    const cachedData = variantsCache[categoryId];
    const cacheTime = cacheTimestamps[categoryId];
    const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

    if (cachedData && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION) {
      setHasVariants(Array.isArray(cachedData?.variants) && cachedData.variants.length > 1);
    } else {
      // No cache yet (or expired); keep null so UI treats as available until cache fills
      setHasVariants(null);
    }
  }, [product?.specificCategory, product?.category?._id, variantsCache, cacheTimestamps]);

  // Helper to decide which image to show and stock status (same logic as ProductCard, adapted for hasVariants=null short-circuit)
  const getDisplayImage = (product) => {
    // Treat on-demand categories as always in stock (e.g., Wraps)
    const isOnDemand = (
      product?.category?.inventoryMode === 'on-demand' ||
      product?.inventoryMode === 'on-demand' ||
      (typeof product?.category === 'string' && product.category.toLowerCase() === 'wraps') ||
      (typeof product?.subCategory === 'string' && product.subCategory.toLowerCase().includes('wrap'))
    );

    // Before cache resolves or when variants exist, show as in-stock. Avoid using product.category.available if category is a string
    const categoryAvailable = (product?.category && typeof product.category === 'object')
      ? (product.category.available !== false)
      : true;
    const variantAvailable = product?.variantDetails ? (product.variantDetails.available !== false) : true;

    let outOfStock = isOnDemand
      ? false
      : ((hasVariants === null || hasVariants === true)
          ? false
          : (!(variantAvailable && categoryAvailable)));

    if (product.images && product.images.length > 0) {
      if (!isOnDemand && hasVariants === false) {
        outOfStock = outOfStock || product.inventoryData?.availableQuantity === 0;
      }
      return { imageUrl: product.images[0], outOfStock };
    }

    if (product.options && product.options.length > 0) {
      for (const option of product.options) {
        if (option.images && option.images.length > 0) {
          if (!isOnDemand && hasVariants === false) {
            outOfStock = outOfStock || option.inventoryData?.availableQuantity === 0;
          }
          return { imageUrl: option.images[0], outOfStock };
        }
      }
    }

    return { imageUrl: null, outOfStock: isOnDemand ? false : (hasVariants === false) };
  };

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
  const { imageUrl: rawImageUrl, outOfStock } = getDisplayImage(product);
  let imageUrl = undefined;
  if (rawImageUrl && typeof rawImageUrl === 'string') {
    const cleaned = rawImageUrl.trim();
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
          position: "relative",
          display: "flex",
          flexDirection: "row",
          gap: 2,
          p: 1.2,
          pr: 1.4,
          borderRadius: 3,
          overflow: "hidden",
          background: "linear-gradient(145deg,#ffffff,#fafafa)",
          border: "1px solid #ececec",
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          minHeight: { xs: 150, sm: 160 },
          transition: "all .28s cubic-bezier(.4,.14,.3,1)",
          "&:hover": {
            boxShadow: "0 6px 18px -4px rgba(0,0,0,0.18)",
            transform: "translateY(-4px)",
            borderColor: "#dcdcdc",
          },
        }}
      >
        {/* Image Wrapper */}
        <Box
          sx={{
            position: "relative",
            width: { xs: 108, sm: 120 },
            flexShrink: 0,
            borderRadius: 2,
            overflow: "hidden",
            aspectRatio: "1/1",
            background: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "& img": {
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform .5s ease",
            },
            ".MuiCard-root:hover & img": {
              transform: "scale(1.05)",
            },
          }}
        >
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={product.name || "Product"}
              fill
              sizes="(max-width: 600px) 40vw, 120px"
              style={{ objectFit: "cover", filter: outOfStock ? "grayscale(100%)" : "none", opacity: outOfStock ? 0.9 : 1 }}
              priority={false}
            />
          )}
          {outOfStock && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: ".78rem",
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
              }}
            >
              Out of Stock
            </Box>
          )}
          {/* Removed old bottom overlay coupon tag; replaced with inline pill below price */}
        </Box>

        {/* Content anchored to bottom */}
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <Box sx={{ flexGrow: 1 }} /> {/* Top empty spacer */}
          <Box sx={{ pr: { xs: 0.5, sm: 1 }, display: "flex", flexDirection: "column", gap: 0.4, pb: 0.2 }}>
            <Typography
              component="h3"
              sx={{
                fontFamily: "Jost, sans-serif",
                fontSize: { xs: "0.82rem", sm: ".9rem" },
                fontWeight: 600,
                color: "#1d1d1f",
                lineHeight: 1.25,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {product.title}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.55 }}>
              <Typography
                sx={{ fontFamily: "Jost, sans-serif", fontSize: { xs: ".95rem", sm: "1rem" }, fontWeight: 700, color: "#111" }}
              >
                ₹{product.price}
              </Typography>
              {product.MRP && product.MRP > product.price && (
                <>
                  <Typography
                    sx={{ textDecoration: "line-through", color: "#888", fontSize: ".63rem", fontFamily: "Jost, sans-serif" }}
                  >
                    ₹{product.MRP}
                  </Typography>
                  {discountPct && (
                    <Typography sx={{ color: "#139455", fontSize: ".6rem", fontWeight: 600, letterSpacing: 0.4 }}>
                      {discountPct}% off
                    </Typography>
                  )}
                </>
              )}
            </Box>
            {unlockableCoupon && !loadingCoupon && (
              <Box
                sx={{
                  display: "inline-flex",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 0.5,
                  px: 0.85,
                  py: 0.45,
                  mt: 0.1,
                  mb: 0.3,
                  background: "linear-gradient(90deg, rgba(49,196,115,0.12), rgba(49,196,115,0.22))",
                  border: "1px solid rgba(49,196,115,0.45)",
                  borderRadius: "14px",
                  fontSize: ".55rem",
                  fontWeight: 600,
                  letterSpacing: 0.6,
                  color: "#0f6b3d",
                  textTransform: "uppercase",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                <LocalOffer sx={{ fontSize: 11, color: "#139455" }} />
                Add this to unlock ₹{unlockableCoupon.discountValue} OFF
              </Box>
            )}
            <Box sx={{ pt: 0.3 }}>
              {outOfStock ? (
                <Typography sx={{ fontSize: 13, my: 1, color: "red", fontFamily: "Jost, sans-serif" }}>Out of stock</Typography>
              ) : (
                <AddToCartButton product={product} enableVariantSelection hideRecommendationPopup size="small" />
              )}
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

    // Add development helper for testing cooldown functionality
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      window.resetRecommendationCooldown = () => {
        dispatch(resetRecommendationCooldown());
        console.log('🔄 Recommendation cooldown reset! Auto-popups will show again.');
      };

      // Log cooldown info for developers
      console.log('💡 Development tip: Use resetRecommendationCooldown() in console to reset the 30-min cooldown.');
    }
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
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <AutoAwesome sx={{ fontSize: "1.2rem", color: "#7b4bff" }} />
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
