"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Box, Typography, useMediaQuery, Skeleton, Fade, Card, CardContent, CardMedia } from "@mui/material";
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
  width: 200,
  flexShrink: 0,
  borderRadius: 12,
  background: "linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)",
  color: "#1a1a1a",
  cursor: "pointer",
  transition: "all 0.3s ease",
  boxShadow: "-8px 0 24px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
  border: "1px solid #d0d7de",
  "&:hover": {
    transform: "translateY(-6px)",
    boxShadow: "-12px 4px 32px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.12)",
    background: "linear-gradient(135deg, #ffffff 0%, #f1f3f4 100%)",
    borderColor: "#8b949e",
  },
  "&::before": {
    content: '""',
    position: "absolute",
    left: -20,
    top: 0,
    bottom: 0,
    width: 20,
    background: "linear-gradient(to right, transparent, rgba(255,255,255,0.1))",
    pointerEvents: "none",
  },
}));

const cardSx = {
  width: 200,
  flexShrink: 0,
  scrollSnapAlign: "start",
  borderRadius: 3,
  transition: "transform .2s",
  cursor: "pointer",
  "&:hover": { transform: "translateY(-6px)", boxShadow: 6 },
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
      <Box sx={{ width: "100%", px: 1, mt: 4 }}>
        {/* Header with skeleton */}
        {loadingInit && !isInitialized && !sectionTitle ? (
          <Skeleton variant="text" width={200} height={32} sx={{ mb: 1 }} />
        ) : (
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
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
              {/* Fixed View All Card */}
              <ViewAllCard onClick={handleViewAllClick}>
                <CardContent
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    minHeight: 200,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    View All
                  </Typography>
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
          filter: outOfStock ? "grayscale(100%)" : "none",
        }}
      >
        <Image src={thumb} alt={product.name || "product"} fill sizes="200px" style={{ objectFit: "cover" }} />
      </CardMedia>
      <CardContent sx={{ pt: 1.5, pb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontFamily: "Jost", fontWeight: 500 }} noWrap>
          {product.name}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
          ₹{product.price}
        </Typography>
        <AddToCartButton fullWidth product={cartPayload} onClick={e => e.stopPropagation()} insertionDetails={insertionDetails} />
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
