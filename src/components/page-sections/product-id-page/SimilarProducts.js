"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Box, Button, Typography, useMediaQuery, Skeleton, Fade, Card, CardContent, CardMedia } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";
import { styled } from "@mui/material/styles";
import Image from "next/image";
import AddToCartButton from "../../utils/AddToCartButton";
import { ITEMS_PER_PAGE } from "@/lib/constants/productsPageConsts";
const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
const DISPLAY_LIMIT = 15; // Show only 10-15 products, no infinite scroll

// Styled components with fixed View All card
const ScrollContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  overflowX: "auto",
  gap: theme.spacing(2),
  paddingBottom: theme.spacing(3),
  scrollSnapType: "x proximity",
  "&::-webkit-scrollbar": { display: "none" },
  msOverflowStyle: "none",
  scrollbarWidth: "none",
  position: "relative",
}));

const ViewAllCard = styled(Card)(({ theme }) => ({
  position: "sticky",
  right: 0,
  zIndex: 10,
  width: 120,
  minWidth: 120,
  flexShrink: 0,
  borderRadius: 16,
  background: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(45, 45, 45, 0.08)",
  color: "#2d2d2d",
  cursor: "pointer",
  transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.04), 0 2px 8px rgba(0, 0, 0, 0.02)",
  overflow: "hidden",
  position: "relative",
  "&:hover": {
    boxShadow: "0 16px 48px rgba(45, 45, 45, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)",
    background: "rgba(45, 45, 45, 0.98)",
    color: "#ffffff",
    borderColor: "rgba(45, 45, 45, 0.2)",
    "& .view-all-icon": {
      transform: "translateX(4px)",
    },
    "& .view-all-text": {
      fontWeight: 600,
    },
    transition: "all 1s ease",
  },
  "&::before": {
    content: '""',
    position: "absolute",
    left: -30,
    top: 0,
    bottom: 0,
    width: 30,
    background: "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 100%)",
    pointerEvents: "none",
    zIndex: 1,
  },
  "&::after": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%, rgba(45, 45, 45, 0.05) 100%)",
    opacity: 0,
    transition: "opacity 0.3s ease",
    pointerEvents: "none",
    zIndex: 2,
  },
  "&:hover::after": {
    opacity: 1,
  },
  [theme.breakpoints.down('sm')]: {
    width: 100,
    minWidth: 100,
  },
}));

const cardSx = {
  width: 200,
  flexShrink: 0,
  scrollSnapAlign: "start",
  borderRadius: '16px',
  transition: "transform .2s, box-shadow .2s",
  cursor: "pointer",
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  border: '1px solid rgba(0,0,0,0.04)',
  "&:hover": { transform: "translateY(-4px)", boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
};

// Helper to get display image (same as TopBoughtProducts)
const getDisplayImage = product => {
  if (product.options?.length) {
    const inStock = product.options.find(o => o.inventoryData?.availableQuantity > 0 && o.images?.length);
    if (inStock) return { imageUrl: inStock.images[0], outOfStock: false };

    const first = product.options.find(o => o.images?.length);
    if (first) return { imageUrl: first.images[0], outOfStock: true };
  }
  if (product.images?.length)
    return {
      imageUrl: product.images[0],
      outOfStock: product.inventoryData?.availableQuantity <= 0,
    };
  return {
    imageUrl: "/images/assets/gifs/helmetloadinggif.gif",
    outOfStock: true,
  };
};

// Context for similar products
const SimilarProductsContext = React.createContext();

// Main component
function SimilarProductsBase({ currentProduct, variant, category }) {
  const router = useRouter();
  const scrollRef = useRef(null);
  const isFirstRender = useRef(true);
  const currentParams = useRef("");

  const [products, setProducts] = useState([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const isSmallDevice = useMediaQuery("(max-width: 600px)");

  // Create insertion details object
  const insertionDetails = {
    component: "similarProducts",
    pageType: "product-id-page",
  };

  // Create stable key for current parameters
  const paramsKey = useMemo(() => `${variant?._id || ""}::${currentProduct?._id || ""}`, [variant?._id, currentProduct?._id]);

  // Fetch limited similar products (no pagination)
  const fetchProducts = useCallback(async () => {
    if (!variant?.pageSlug) return;

    try {
      setLoadingInit(true);

      const response = await fetch("/api/shop/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: variant.pageSlug.replace(/^\//, "").split("/"),
          page: 1,
          limit: DISPLAY_LIMIT, // Only fetch limited products
          tagFilter: null,
          sortBy: "default",
          next: { revalidate: 6000 },
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();

      if (data.type === "variant") {
        // Filter out current product and limit to DISPLAY_LIMIT
        let filteredProducts = data.products.filter(product => product._id !== currentProduct._id).slice(0, DISPLAY_LIMIT);

        // Add selectedOption like TopBoughtProducts
        const ready = filteredProducts.map(p =>
          Array.isArray(p.options) && p.options.length ? { ...p, selectedOption: p.options[0] } : p
        );

        setProducts(ready);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error("Error fetching similar products:", error);
      setIsInitialized(true);
      setProducts([]);
    } finally {
      setLoadingInit(false);
    }
  }, [variant?.pageSlug, currentProduct._id]);

  // Initial load effect
  useEffect(() => {
    // Skip if parameters haven't changed and we already have data
    if (currentParams.current === paramsKey && products.length > 0 && isInitialized) {
      return;
    }

    // Skip duplicate calls in React strict mode
    if (currentParams.current === paramsKey && isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Update current parameters
    currentParams.current = paramsKey;
    isFirstRender.current = false;

    // Reset state for new fetch
    setIsInitialized(false);
    setLoadingInit(true);

    // Start fetching
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, fetchProducts]);

  // Handle View All click - navigate to product list page
  const handleViewAllClick = useCallback(() => {
    if (variant?.pageSlug) {
      router.push(`/shop${variant.pageSlug}`);
    }
  }, [variant?.pageSlug, router]);

  // Section title
  const sectionTitle = `Similar ${variant?.name || "Products"}`;

  // Don't render if no variant
  if (!variant) {
    return null;
  }

  return (
    <SimilarProductsContext.Provider value={{ insertionDetails }}>
      <Box sx={{ 
        width: "100%", 
        px: { xs: 1, sm: 2 },
        py: 2.5,
        my: 3,
        bgcolor: 'rgba(0,0,0,0.02)',
        borderRadius: '20px',
        border: '1px solid rgba(0,0,0,0.04)',
      }}>
        {/* Header with skeleton */}
        {loadingInit && !isInitialized && !sectionTitle ? (
          <Skeleton variant="text" width={200} height={26} sx={{ mb: 1, mt: 3 }} />
        ) : (
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, mt: 3 }}>
            {sectionTitle}
          </Typography>
        )}

        {/* Loading skeletons or products */}
        {loadingInit && !isInitialized ? (
          <ScrollContainer>
            {Array.from({ length: DISPLAY_LIMIT }).map((_, i) => (
              <ProductCardSkeleton key={`skel-${i}`} />
            ))}
          </ScrollContainer>
        ) : (
          <Fade in={isInitialized && products.length > 0}>
            <ScrollContainer ref={scrollRef}>
              {products.map((p, i) => (
                <ProductCard key={`${p._id}-${i}`} product={p} />
              ))}
              {/* Minimal View All Card */}
              <ViewAllCard onClick={handleViewAllClick}>
                <CardContent
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    minHeight: { xs: 160, sm: 180 },
                    textAlign: "center",
                    position: "relative",
                    zIndex: 3,
                    p: { xs: 1.5, sm: 2 },
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: { xs: 0.5, sm: 1 },
                    }}
                  >
                    <Typography 
                      variant="body2" 
                      className="view-all-text"
                      sx={{ 
                        fontWeight: 500,
                        fontSize: { xs: "0.75rem", sm: "0.875rem" },
                        lineHeight: 1.2,
                        transition: "all 0.3s ease",
                        letterSpacing: "0.025em",
                      }}
                    >
                      View
                    </Typography>
                    <Typography 
                      variant="body2" 
                      className="view-all-text"
                      sx={{ 
                        fontWeight: 500,
                        fontSize: { xs: "0.75rem", sm: "0.875rem" },
                        lineHeight: 1.2,
                        transition: "all 0.3s ease",
                        letterSpacing: "0.025em",
                        mt: -0.5,
                      }}
                    >
                      All
                    </Typography>
                    <ArrowForward 
                      className="view-all-icon"
                      sx={{ 
                        fontSize: { xs: 16, sm: 18 },
                        mt: { xs: 0.5, sm: 1 },
                        transition: "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                        opacity: 0.8,
                      }} 
                    />
                  </Box>
                </CardContent>
              </ViewAllCard>
            </ScrollContainer>
          </Fade>
        )}

        {/* Show message when no products are found and not loading */}
        {isInitialized && products.length === 0 && !loadingInit && (
          <Box sx={{ textAlign: "center", py: 4, color: "text.secondary" }}>
            <Typography variant="body2">No similar products found.</Typography>
          </Box>
        )}
      </Box>
    </SimilarProductsContext.Provider>
  );
}

// Product Card (similar to TopBoughtProducts)
const ProductCard = memo(function ProductCard({ product }) {
  const router = useRouter();
  const { imageUrl, outOfStock } = getDisplayImage(product);
  const { insertionDetails } = React.useContext(SimilarProductsContext);

  const thumb = useMemo(
    () => (imageUrl.startsWith("/") ? `${baseImageUrl}${imageUrl}` : `${baseImageUrl}/${imageUrl}`),
    [imageUrl]
  );

  const cartPayload = useMemo(() => ({ ...product, thumbnail: thumb }), [product, thumb]);

  const handleClick = () => {
    // Use full page navigation with refresh - this ensures proper product loading
    router.push(`/shop${product.pageSlug || ""}`);
  };

  return (
    <Card sx={cardSx} onClick={handleClick}>
      <CardMedia
        sx={{
          position: "relative",
          pt: "75%",
          filter: outOfStock ? "grayscale(20%) brightness(0.95)" : "none",
          opacity: outOfStock ? 0.9 : 1,
        }}
      >
        <Image src={thumb} alt={product.name || "product"} fill sizes="200px" style={{ objectFit: "cover" }} />
        {outOfStock && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              color: '#d32f2f',
              padding: '4px 8px',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '0.75rem',
              fontFamily: 'Jost, sans-serif',
              textAlign: 'center',
              zIndex: 1,
              border: '1px solid rgba(211, 47, 47, 0.2)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            Out of Stock
          </Box>
        )}
      </CardMedia>
      <CardContent sx={{ pt: 1.5, pb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontFamily: "Jost", fontWeight: 500 }} noWrap>
          {product.name}
        </Typography>
        {/* Price with MRP and discount */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
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
                  fontWeight: 400
                }}
              >
                ₹{product.MRP}
              </Typography>
              <Typography
                variant="caption"
                sx={{ 
                  color: '#2e7d32', 
                  fontWeight: 600,
                  fontSize: '0.7rem'
                }}
              >
                {Math.round(((product.MRP - product.price) / product.MRP) * 100)}% off
              </Typography>
            </>
          )}
        </Box>
        {!outOfStock ? (
          <AddToCartButton 
            fullWidth 
            product={cartPayload} 
            onClick={e => e.stopPropagation()} 
            insertionDetails={insertionDetails}
            disableNotifyMe={true} // Disable notify for POD items in similar products
          />
        ) : (
          <Button  onClick={handleClick} sx={{ mt: 1, width: '100%', borderRadius: '0.4rem', bgcolor: 'grey.800', textTransform: 'none', fontSize: '1rem', fontWeight: 500, fontFamily: 'Jost' }} variant="contained">
            View Product
          </Button>
        )}
      </CardContent>
    </Card>
  );
});

// Product Card Skeleton (same as TopBoughtProducts)
const ProductCardSkeleton = memo(function ProductCardSkeleton() {
  return (
    <Card sx={cardSx}>
      <Skeleton variant="rectangular" animation="wave" sx={{ pt: "75%" }} />
      <CardContent sx={{ pb: 2 }}>
        <Skeleton variant="text" width="80%" height={20} />
        <Skeleton variant="text" width="40%" height={20} />
        <Skeleton variant="rectangular" width="100%" height={36} sx={{ mt: 1 }} />
      </CardContent>
    </Card>
  );
});

// Memoized component
const SimilarProducts = memo(SimilarProductsBase);

export default SimilarProducts;
