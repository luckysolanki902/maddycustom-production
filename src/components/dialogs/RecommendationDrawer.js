"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Drawer,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Skeleton,
} from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { Close, ArrowForward, LocalOffer } from "@mui/icons-material";
import { closeRecommendationDrawer, resetRecommendationCooldown, openCartDrawer } from "@/store/slices/uiSlice";
import AddToCartButton from "@/components/utils/AddToCartButton";
import Image from "next/image";
import usePageType from "@/hooks/usePageType";
import funnelClient from "@/lib/analytics/funnelClient";

// Hero Product Card - Larger, featured position
const HeroProductCard = ({ product, onCardClick }) => {
  const cartItems = useSelector(state => state.cart.items);
  const variantsCache = useSelector(state => state.variants.cache);
  const cacheTimestamps = useSelector(state => state.variants.lastUpdated);
  const [hasVariants, setHasVariants] = useState(null);
  const [unlockableCoupon, setUnlockableCoupon] = useState(null);
  const [loadingCoupon, setLoadingCoupon] = useState(false);
  const pageType = usePageType();

  useEffect(() => {
    const categoryId = product?.specificCategory || product?.category?._id;
    if (!categoryId) {
      setHasVariants(false);
      return;
    }
    const cachedData = variantsCache[categoryId];
    const cacheTime = cacheTimestamps[categoryId];
    const CACHE_DURATION = 30 * 60 * 1000;

    if (cachedData && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION) {
      setHasVariants(Array.isArray(cachedData?.variants) && cachedData.variants.length > 1);
    } else {
      setHasVariants(null);
    }
  }, [product?.specificCategory, product?.category?._id, variantsCache, cacheTimestamps]);

  const getDisplayImage = (product) => {
    const isOnDemand = (
      product?.category?.inventoryMode === 'on-demand' ||
      product?.inventoryMode === 'on-demand' ||
      (typeof product?.category === 'string' && product.category.toLowerCase() === 'wraps') ||
      (typeof product?.subCategory === 'string' && product.subCategory.toLowerCase().includes('wrap'))
    );

    const categoryAvailable = (product?.category && typeof product.category === 'object')
      ? (product.category.available !== false) : true;
    const variantAvailable = product?.variantDetails ? (product.variantDetails.available !== false) : true;

    let outOfStock = isOnDemand ? false : ((hasVariants === null || hasVariants === true)
      ? false : (!(variantAvailable && categoryAvailable)));

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

  const calculateCurrentCartValue = useCallback(() => {
    return cartItems.reduce((total, item) => {
      const price = item.price || item.productDetails?.price || 0;
      return total + price * item.quantity;
    }, 0);
  }, [cartItems]);

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
      setUnlockableCoupon(null);
    } finally {
      setLoadingCoupon(false);
    }
  }, [product.price, calculateCurrentCartValue]);

  useEffect(() => {
    fetchUnlockableCoupon();
  }, [fetchUnlockableCoupon]);

  const baseCdn = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || "";
  const { imageUrl: rawImageUrl, outOfStock } = getDisplayImage(product);
  let imageUrl = undefined;
  if (rawImageUrl && typeof rawImageUrl === 'string') {
    const cleaned = rawImageUrl.trim();
    if (cleaned && cleaned !== '/' && cleaned.toLowerCase() !== 'null' && cleaned.toLowerCase() !== 'undefined') {
      imageUrl = cleaned.startsWith('http') ? cleaned : `${baseCdn}${cleaned.startsWith('/') ? cleaned : '/' + cleaned}`;
    }
  }
  if (!imageUrl) imageUrl = '/images/off.jpg';

  const discountPct = product.MRP && product.MRP > product.price
    ? Math.round(((product.MRP - product.price) / product.MRP) * 100) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <Card
        onClick={() => onCardClick(product)}
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          overflow: "hidden",
          background: "#fff",
          border: "1px solid #eaeaea",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          transition: "all .25s ease",
          cursor: "pointer",
          "&:hover": {
            boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
            transform: "translateY(-2px)",
          },
        }}
      >
        {/* Best Match Label */}
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 2,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            color: "#fff",
            px: 1.25,
            py: 0.4,
            borderRadius: "20px",
            fontSize: "0.6rem",
            fontWeight: 500,
            fontFamily: "Jost, sans-serif",
            letterSpacing: "0.3px",
            textTransform: "uppercase",
          }}
        >
          Best Match
        </Box>

        {/* Image */}
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/9",
            background: "#f8f8f8",
            overflow: "hidden",
          }}
        >
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={product.name || "Product"}
              fill
              sizes="(max-width: 600px) 100vw, 50vw"
              style={{ 
                objectFit: "cover", 
                filter: outOfStock ? "grayscale(100%)" : "none", 
                opacity: outOfStock ? 0.7 : 1 
              }}
              priority
            />
          )}
          {outOfStock && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "0.85rem",
                fontWeight: 600,
                letterSpacing: 0.5,
              }}
            >
              Currently Unavailable
            </Box>
          )}
        </Box>

        {/* Content */}
        <Box sx={{ p: 2, pt: 1.5 }}>
          <Typography
            component="h3"
            sx={{
              fontFamily: "Jost, sans-serif",
              fontSize: "1rem",
              fontWeight: 600,
              color: "#1d1d1f",
              lineHeight: 1.3,
              mb: 0.75,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.title || product.name}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mb: 1 }}>
            <Typography
              sx={{ fontFamily: "Jost, sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#2d2d2d" }}
            >
              ₹{product.price}
            </Typography>
            {product.MRP && product.MRP > product.price && (
              <>
                <Typography
                  sx={{ textDecoration: "line-through", color: "#999", fontSize: "0.8rem", fontFamily: "Jost, sans-serif" }}
                >
                  ₹{product.MRP}
                </Typography>
                {discountPct && (
                  <Typography sx={{ color: "#2e7d32", fontSize: "0.75rem", fontWeight: 600 }}>
                    {discountPct}% off
                  </Typography>
                )}
              </>
            )}
          </Box>

          {/* Coupon Unlock - Action-first framing with fixed height to prevent layout shift */}
          <Box sx={{ minHeight: '1.75rem', mb: 0.5 }}>
            {loadingCoupon ? (
              <Skeleton variant="rounded" width={140} height={22} sx={{ borderRadius: '20px' }} />
            ) : unlockableCoupon ? (
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1,
                  py: 0.4,
                  background: "linear-gradient(135deg, rgba(46, 125, 50, 0.06) 0%, rgba(46, 125, 50, 0.12) 100%)",
                  border: "1px solid rgba(46, 125, 50, 0.2)",
                  borderRadius: "20px",
                  fontSize: "0.68rem",
                  fontWeight: 500,
                  color: "#2e7d32",
                  fontFamily: "Jost, sans-serif",
                }}
              >
                <LocalOffer sx={{ fontSize: 12 }} />
                Unlock ₹{unlockableCoupon.discountValue} OFF
              </Box>
            ) : null}
          </Box>

          {/* Add to Cart Button */}
          <Box onClick={(e) => e.stopPropagation()}>
            {outOfStock ? (
              <Typography sx={{ fontSize: 13, color: "#999", fontFamily: "Jost, sans-serif" }}>
                Out of stock
              </Typography>
            ) : (
              <AddToCartButton 
                product={product} 
                enableVariantSelection 
                hideRecommendationPopup 
                isBlackButton
                drawerPrimary
                disableNotifyMe={true}
                customAddText="Add to Order"
                customVariantText="Select & Add"
              />
            )}
          </Box>
        </Box>
      </Card>
    </motion.div>
  );
};

// Secondary Product Card - Compact horizontal layout
const SecondaryProductCard = ({ product, onCardClick, index }) => {
  const cartItems = useSelector(state => state.cart.items);
  const variantsCache = useSelector(state => state.variants.cache);
  const cacheTimestamps = useSelector(state => state.variants.lastUpdated);
  const [hasVariants, setHasVariants] = useState(null);
  const [unlockableCoupon, setUnlockableCoupon] = useState(null);
  const [loadingCoupon, setLoadingCoupon] = useState(true);
  const pageType = usePageType();

  useEffect(() => {
    const categoryId = product?.specificCategory || product?.category?._id;
    if (!categoryId) {
      setHasVariants(false);
      return;
    }
    const cachedData = variantsCache[categoryId];
    const cacheTime = cacheTimestamps[categoryId];
    const CACHE_DURATION = 30 * 60 * 1000;

    if (cachedData && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION) {
      setHasVariants(Array.isArray(cachedData?.variants) && cachedData.variants.length > 1);
    } else {
      setHasVariants(null);
    }
  }, [product?.specificCategory, product?.category?._id, variantsCache, cacheTimestamps]);

  const getDisplayImage = (product) => {
    const isOnDemand = (
      product?.category?.inventoryMode === 'on-demand' ||
      product?.inventoryMode === 'on-demand' ||
      (typeof product?.category === 'string' && product.category.toLowerCase() === 'wraps') ||
      (typeof product?.subCategory === 'string' && product.subCategory.toLowerCase().includes('wrap'))
    );

    const categoryAvailable = (product?.category && typeof product.category === 'object')
      ? (product.category.available !== false) : true;
    const variantAvailable = product?.variantDetails ? (product.variantDetails.available !== false) : true;

    let outOfStock = isOnDemand ? false : ((hasVariants === null || hasVariants === true)
      ? false : (!(variantAvailable && categoryAvailable)));

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

  const calculateCurrentCartValue = useCallback(() => {
    return cartItems.reduce((total, item) => {
      const price = item.price || item.productDetails?.price || 0;
      return total + price * item.quantity;
    }, 0);
  }, [cartItems]);

  useEffect(() => {
    const fetchCoupon = async () => {
      const currentCartValue = calculateCurrentCartValue();
      const potentialCartValue = currentCartValue + (product.price || 0);
      if (potentialCartValue <= currentCartValue) {
        setLoadingCoupon(false);
        return;
      }

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
        }
      } catch (error) {
        // Silent fail
      } finally {
        setLoadingCoupon(false);
      }
    };
    fetchCoupon();
  }, [product.price, calculateCurrentCartValue]);

  const baseCdn = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL || "";
  const { imageUrl: rawImageUrl, outOfStock } = getDisplayImage(product);
  let imageUrl = undefined;
  if (rawImageUrl && typeof rawImageUrl === 'string') {
    const cleaned = rawImageUrl.trim();
    if (cleaned && cleaned !== '/' && cleaned.toLowerCase() !== 'null' && cleaned.toLowerCase() !== 'undefined') {
      imageUrl = cleaned.startsWith('http') ? cleaned : `${baseCdn}${cleaned.startsWith('/') ? cleaned : '/' + cleaned}`;
    }
  }
  if (!imageUrl) imageUrl = '/images/off.jpg';

  const discountPct = product.MRP && product.MRP > product.price
    ? Math.round(((product.MRP - product.price) / product.MRP) * 100) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.35, delay: 0.15 + (index * 0.08) }}
    >
      <Card
        onClick={() => onCardClick(product)}
        sx={{
          display: "flex",
          flexDirection: "row",
          gap: 1.5,
          p: 1.25,
          borderRadius: "14px",
          overflow: "hidden",
          background: "#fff",
          border: "1px solid #f0f0f0",
          boxShadow: "none",
          minHeight: 100,
          transition: "all .2s ease",
          cursor: "pointer",
          "&:hover": {
            borderColor: "#e0e0e0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          },
        }}
      >
        {/* Image */}
        <Box
          sx={{
            position: "relative",
            width: 88,
            height: 88,
            flexShrink: 0,
            borderRadius: "10px",
            overflow: "hidden",
            background: "#f8f8f8",
          }}
        >
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={product.name || "Product"}
              fill
              sizes="90px"
              style={{ 
                objectFit: "cover", 
                filter: outOfStock ? "grayscale(100%)" : "none", 
                opacity: outOfStock ? 0.7 : 1 
              }}
            />
          )}
          {outOfStock && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "0.6rem",
                fontWeight: 600,
              }}
            >
              Unavailable
            </Box>
          )}
        </Box>

        {/* Content */}
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, justifyContent: "center" }}>
          <Typography
            component="h4"
            sx={{
              fontFamily: "Jost, sans-serif",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#2d2d2d",
              lineHeight: 1.25,
              mb: 0.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {product.title || product.name}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mb: 0.5 }}>
            <Typography
              sx={{ fontFamily: "Jost, sans-serif", fontSize: "0.9rem", fontWeight: 700, color: "#2d2d2d" }}
            >
              ₹{product.price}
            </Typography>
            {product.MRP && product.MRP > product.price && (
              <Typography
                sx={{ textDecoration: "line-through", color: "#999", fontSize: "0.7rem", fontFamily: "Jost, sans-serif" }}
              >
                ₹{product.MRP}
              </Typography>
            )}
            {discountPct && (
              <Typography sx={{ color: "#2e7d32", fontSize: "0.65rem", fontWeight: 600 }}>
                {discountPct}% off
              </Typography>
            )}
          </Box>

          {/* Coupon with fixed height placeholder to prevent layout shift */}
          <Box sx={{ minHeight: '1.35rem' }}>
            {loadingCoupon ? (
              <Skeleton variant="rounded" width={100} height={18} sx={{ borderRadius: '12px' }} />
            ) : unlockableCoupon ? (
              <Typography
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.35,
                  fontSize: "0.6rem",
                  fontWeight: 500,
                  color: "#2e7d32",
                  fontFamily: "Jost, sans-serif",
                  background: "rgba(46, 125, 50, 0.08)",
                  px: 0.75,
                  py: 0.25,
                  borderRadius: "12px",
                  width: "fit-content",
                }}
              >
                <LocalOffer sx={{ fontSize: 10 }} />
                Unlock ₹{unlockableCoupon.discountValue} OFF
              </Typography>
            ) : null}
          </Box>

          {/* Add to Cart */}
          <Box onClick={(e) => e.stopPropagation()} sx={{ mt: 0.5 }}>
            {!outOfStock && (
              <AddToCartButton 
                product={product} 
                enableVariantSelection 
                hideRecommendationPopup 
                isBlackButton
                drawerSecondary
                disableNotifyMe={true}
                customAddText="Add to Order"
                customVariantText="Select"
              />
            )}
          </Box>
        </Box>
      </Card>
    </motion.div>
  );
};

const RecommendationDrawer = () => {
  const dispatch = useDispatch();
  const { isRecommendationDrawerOpen, recommendationProduct } = useSelector(state => state.ui);
  const cartItems = useSelector(state => state.cart.items);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRecommendedProducts = useCallback(
    async designGroupId => {
      setLoading(true);
      try {
        const response = await fetch(`/api/products/by-design-group/${designGroupId}`);
        const data = await response.json();

        if (data.success) {
          // Filter out the current product and limit to 5 products total (1 hero + 4 secondary)
          const filtered = data.products.filter(product => product._id !== recommendationProduct._id).slice(0, 5);
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
      
      // Track drawer open
      try {
        funnelClient.track('recommendation_drawer_view', {
          metadata: {
            triggerProduct: recommendationProduct?._id,
            designGroupId: recommendationProduct?.designGroupId,
          },
        });
      } catch (e) {}
    }
  }, [isRecommendationDrawerOpen, recommendationProduct, fetchRecommendedProducts]);

  const handleClose = () => {
    dispatch(closeRecommendationDrawer());
    setRecommendedProducts([]);

    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      window.resetRecommendationCooldown = () => {
        dispatch(resetRecommendationCooldown());
        console.log('Recommendation cooldown reset.');
      };
    }
  };

  const handleViewCart = () => {
    handleClose();
    dispatch(openCartDrawer({ source: 'bottom' }));
  };

  const handleCardClick = (product) => {
    if (product.pageSlug) {
      window.open(`${process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'}/shop${product.pageSlug}`, '_blank');
    }
  };

  // Get cart count for CTA
  const cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Split products: first one is hero, rest are secondary
  const heroProduct = recommendedProducts[0];
  const secondaryProducts = recommendedProducts.slice(1);

  const ProductSkeleton = () => (
    <Card
      sx={{
        height: 160,
        border: "1px solid #f0f0f0",
        boxShadow: "none",
        borderRadius: "14px",
      }}
    >
      <Box sx={{ display: "flex", height: "100%" }}>
        <Skeleton variant="rectangular" width={120} height="100%" sx={{ borderRadius: "14px 0 0 14px" }} />
        <CardContent sx={{ flex: 1, p: 2 }}>
          <Skeleton variant="text" width="80%" height={20} />
          <Skeleton variant="text" width="60%" height={16} sx={{ mt: 1 }} />
          <Skeleton variant="rectangular" width="100%" height={32} sx={{ mt: 2, borderRadius: "10px" }} />
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
          // Mobile: full-width bottom sheet
          borderTopLeftRadius: { xs: 24, md: 20 },
          borderTopRightRadius: { xs: 24, md: 20 },
          borderBottomLeftRadius: { xs: 0, md: 20 },
          borderBottomRightRadius: { xs: 0, md: 20 },
          backgroundColor: "#fafafa",
          height: "auto",
          maxHeight: { xs: "88vh", md: "85vh" },
          // Desktop: bottom-right floating panel
          position: { md: "fixed" },
          bottom: { md: 24 },
          right: { md: 24 },
          left: { md: "auto" },
          width: { xs: "100%", md: 380 },
          boxShadow: { md: "0 8px 40px rgba(0,0,0,0.15)" },
        },
      }}
      // Prevent backdrop click issues on desktop
      ModalProps={{
        sx: {
          // On desktop, make backdrop lighter
          "& .MuiBackdrop-root": {
            backgroundColor: { xs: "rgba(0,0,0,0.5)", md: "rgba(0,0,0,0.25)" },
          },
        },
      }}
    >
      <AnimatePresence>
        {isRecommendationDrawerOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          >
            <Box
              sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                maxHeight: { xs: "88vh", md: "85vh" },
              }}
            >
              {/* Drag Handle - only on mobile */}
              <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", pt: 1.5, pb: 0.5 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 4,
                    backgroundColor: "#d0d0d0",
                    borderRadius: 2,
                  }}
                />
              </Box>

              {/* Header */}
              <Box
                sx={{
                  px: { xs: 3, md: 2.5 },
                  pt: { xs: 1.5, md: 2 },
                  pb: 2,
                  position: "relative",
                  background: "#fafafa",
                }}
              >
                <IconButton
                  onClick={handleClose}
                  sx={{
                    position: "absolute",
                    top: { xs: 8, md: 12 },
                    right: 12,
                    color: "#999",
                    width: 32,
                    height: 32,
                    "&:hover": {
                      backgroundColor: "#f0f0f0",
                      color: "#666",
                    },
                  }}
                >
                  <Close sx={{ fontSize: 18 }} />
                </IconButton>

                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    color: "#2d2d2d",
                    fontFamily: "Jost, sans-serif",
                    fontSize: { xs: "1.15rem", md: "1.05rem" },
                    letterSpacing: "-0.01em",
                  }}
                >
                  Complete Your Setup
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: "#757575",
                    fontFamily: "Jost, sans-serif",
                    fontSize: { xs: "0.85rem", md: "0.78rem" },
                    mt: 0.5,
                    pr: 4,
                  }}
                >
                  These designs were made to go together
                </Typography>
              </Box>

              {/* Content */}
              <Box
                sx={{
                  px: { xs: 2.5, md: 2 },
                  pb: 2,
                  flex: 1,
                  overflowY: "auto",
                  overflowX: "hidden",
                }}
              >
                {loading ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <Skeleton variant="rectangular" height={200} sx={{ borderRadius: "12px" }} />
                    <ProductSkeleton />
                    <ProductSkeleton />
                  </Box>
                ) : recommendedProducts.length > 0 ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    {/* Hero Product */}
                    {heroProduct && (
                      <HeroProductCard product={heroProduct} onCardClick={handleCardClick} />
                    )}
                    
                    {/* Secondary Products */}
                    {secondaryProducts.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography
                          sx={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "#999",
                            fontFamily: "Jost, sans-serif",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            mb: 1.25,
                            px: 0.5,
                          }}
                        >
                          More from this collection
                        </Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          {secondaryProducts.map((product, index) => (
                            <SecondaryProductCard 
                              key={product._id} 
                              product={product} 
                              onCardClick={handleCardClick}
                              index={index}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      textAlign: "center",
                      py: 6,
                      color: "#999",
                    }}
                  >
                    <Typography variant="body2" sx={{ fontFamily: "Jost, sans-serif" }}>
                      No matching items found
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Footer */}
              <Box
                sx={{
                  position: "sticky",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: "#fff",
                  borderTop: "1px solid #eee",
                  px: { xs: 2.5, md: 2 },
                  py: { xs: 1.75, md: 1.5 },
                  boxShadow: "0 -4px 12px rgba(0,0,0,0.04)",
                  // Desktop: rounded bottom corners
                  borderBottomLeftRadius: { xs: 0, md: 20 },
                  borderBottomRightRadius: { xs: 0, md: 20 },
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 1.25,
                  }}
                >
                  <Button
                    variant="text"
                    fullWidth
                    onClick={handleClose}
                    sx={{
                      color: "#777",
                      py: { xs: 1.35, md: 1.1 },
                      fontSize: { xs: "0.82rem", md: "0.78rem" },
                      fontWeight: 500,
                      borderRadius: "12px",
                      border: "1px solid #e8e8e8",
                      "&:hover": {
                        backgroundColor: "#f8f8f8",
                        borderColor: "#ddd",
                      },
                      fontFamily: "Jost, sans-serif",
                      textTransform: "none",
                    }}
                  >
                    Maybe Later
                  </Button>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleViewCart}
                    endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
                    sx={{
                      backgroundColor: "#2d2d2d",
                      py: { xs: 1.35, md: 1.1 },
                      fontSize: { xs: "0.82rem", md: "0.78rem" },
                      fontWeight: 600,
                      borderRadius: "12px",
                      "&:hover": {
                        backgroundColor: "#1a1a1a",
                      },
                      fontFamily: "Jost, sans-serif",
                      textTransform: "none",
                      boxShadow: "none",
                    }}
                  >
                    Review Order{cartCount > 0 ? ` (${cartCount})` : ''}
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
