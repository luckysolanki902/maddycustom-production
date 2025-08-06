"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Drawer, Box, Typography, Card, CardMedia, CardContent, Button, IconButton, Skeleton } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { Close, ShoppingCart, ArrowForward, LocalOffer } from "@mui/icons-material";
import { closeRecommendationDrawer } from "@/store/slices/uiSlice";
import AddToCartButton from "@/components/utils/AddToCartButton";

// Product Card Component with Coupon Information
const ProductCardWithCoupon = ({ product }) => {
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart.items);
  const [unlockableCoupon, setUnlockableCoupon] = useState(null);
  const [loadingCoupon, setLoadingCoupon] = useState(false);

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

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card
        sx={{
          height: unlockableCoupon ? 200 : 160, // Increased height when coupon is available
          border: "1px solid #f0f0f0",
          borderRadius: 2,
          transition: "all 0.2s ease",
          position: "relative",
          overflow: "visible",
          "&:hover": {
            borderColor: "#2d2d2d",
            boxShadow: "0 4px 12px rgba(45, 45, 45, 0.1)",
            transform: "translateY(-2px)",
          },
        }}
      >
        {/* Coupon Badge */}
        <AnimatePresence>
          {unlockableCoupon && !loadingCoupon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ duration: 0.3 }}
              style={{
                position: "absolute",
                top: -8,
                right: -8,
                zIndex: 20,
              }}
            >
              <Box
                sx={{
                  backgroundColor: "#e6f7ed",
                  borderRadius: "12px",
                  px: 1.5,
                  py: 0.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                <LocalOffer sx={{ fontSize: 14, color: "#31C473" }} />
                <Typography
                  variant="caption"
                  sx={{
                    color: "#31C473",
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    lineHeight: 1,
                  }}
                >
                  ₹{unlockableCoupon.discountValue} OFF
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        <Box sx={{ display: "flex", height: "100%", flexDirection: "column" }}>
          {/* Product Content */}
          <Box sx={{ display: "flex", flex: 1 }}>
            <CardMedia
              component="img"
              sx={{
                width: 120,
                objectFit: "cover",
                borderTopLeftRadius: 8,
                borderBottomLeftRadius: unlockableCoupon ? 0 : 8,
              }}
              image={
                product.images?.[0]
                  ? `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${product.images[0]}`
                  : "/images/placeholder.jpg"
              }
              alt={product.name}
            />
            <CardContent
              sx={{
                flex: 1,
                p: 2,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 600,
                    color: "#2d2d2d",
                    lineHeight: 1.3,
                    mb: 0.5,
                    fontFamily: "Jost, sans-serif",
                  }}
                >
                  {product.title}
                </Typography>

                {/* Card Captions */}
                {/* {product.variantDetails?.cardCaptions?.map((caption, index) => {
                  const charLimit = 30; // Shorter for drawer
                  const shortenedString = caption.length > charLimit ? caption.slice(0, charLimit) + "...more" : caption;
                  return (
                    <Typography
                      key={index}
                      variant="caption"
                      sx={{
                        color: "#666",
                        fontSize: "0.65rem",
                        display: "block",
                        lineHeight: 1.2,
                        mb: 0.3,
                        fontFamily: "Jost, sans-serif",
                      }}
                    >
                      {shortenedString}
                    </Typography>
                  );
                })} */}

                {/* Price Section */}
                <Box sx={{ mt: 0.5, mb: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 800,
                      color: "#2d2d2d",
                      fontSize: "1rem",
                      fontFamily: "Jost, sans-serif",
                    }}
                  >
                    ₹{product.price}
                  </Typography>
                  {product.MRP && product.MRP > product.price && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.2 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          textDecoration: "line-through",
                          color: "#999",
                          fontSize: "0.7rem",
                          fontFamily: "Jost, sans-serif",
                        }}
                      >
                        ₹{product.MRP}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#31C473",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          fontFamily: "Jost, sans-serif",
                        }}
                      >
                        {Math.round(((product.MRP - product.price) / product.MRP) * 100)}% off
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              <AddToCartButton
                product={product}
                size="small"
                sx={{
                  backgroundColor: "#2d2d2d",
                  color: "white",
                  fontSize: "0.75rem",
                  py: 0.5,
                  minHeight: 32,
                  "&:hover": {
                    backgroundColor: "#1a1a1a",
                  },
                }}
              />
            </CardContent>
          </Box>

          {/* Coupon Information */}
          <AnimatePresence>
            {unlockableCoupon && !loadingCoupon && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Box
                  sx={{
                    backgroundColor: "#424242",
                    p: 1.5,
                    borderBottomLeftRadius: 8,
                    borderBottomRightRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                  }}
                >
                  <LocalOffer sx={{ fontSize: 16, color: "white" }} />
                  <Typography
                    variant="caption"
                    sx={{
                      color: "white",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      textAlign: "center",
                      fontFamily: "Jost, sans-serif",
                    }}
                  >
                    Add this to unlock ₹{unlockableCoupon.discountValue} savings!
                  </Typography>
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
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
          // Filter out the current product and limit to 6 products
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
                minHeight: window.innerWidth <= 600 ? "60vh" : "40vh",
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
                  Complete Your Style
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
                  p: 3,
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
                      py: 1.5,
                      fontWeight: 600,
                      minHeight: 48,
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
                      py: 1.5,
                      fontWeight: 600,
                      minHeight: 48,
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
