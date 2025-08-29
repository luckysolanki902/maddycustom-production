// src/components/common-utils/AddToCartButton.js
"use client";

import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSpring, animated } from "react-spring";
import styles from "./styles/addtocartbutton.module.css";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import { addItem, incrementQuantity, decrementQuantity, removeItem, setDefaultWrapFinish } from "../../store/slices/cartSlice";
import { openCartDrawer, openRecommendationDrawer } from "../../store/slices/uiSlice";
import { addToCart as trackAddToCart } from "@/lib/metadata/facebookPixels";
import SimilarProductsToast from "../notifications/SimilarProductsToast";
import { Dialog, DialogContent, Box, Typography, Divider, Button, Checkbox, FormControlLabel, Skeleton } from "@mui/material";
import { useRouter } from "next/navigation";
import { setPageSlug } from "../../store/slices/variantPreferenceSlice";
import Image from "next/image";

export default function AddToCartButton({
  product,
  isBlackButton = false,
  isLarge = false,
  smaller = false,
  insertionDetails = {},
  enableVariantSelection = false,
  hideRecommendationPopup = false,
  showOnlyChooseVariants = false
}) {
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart.items);
  const cartItem = cartItems.find(item => item.productId === product._id);

  // State to track last action for animation
  const [lastAction, setLastAction] = useState(null); // 'increment' or 'decrement'

  // State for similar products toast
  const [showSimilarToast, setShowSimilarToast] = useState(false);
  const [toastProduct, setToastProduct] = useState(null);

  // Variant selection state
  const [variants, setVariants] = useState([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const router = useRouter();

  // Static cache outside component to persist across all instances
  const getVariantCache = (() => {
    if (typeof window !== "undefined") {
      if (!window.__variantCache) {
        window.__variantCache = new Map();
      }
      return window.__variantCache;
    }
    return new Map();
  })();

  // React Spring animation for quantity
  const props = useSpring({
    // Animate scale and color based on lastAction
    scale: lastAction === "increment" || lastAction === "decrement" ? 1.1 : 1,
    color: "#fff",
    opacity: cartItem ? 1 : 0,
    config: {
      tension: 300,
      friction: 10,
    },
    onRest: () => {
      // Reset scale and color after animation
      if (lastAction) {
        setLastAction(null);
      }
    },
  });
  useEffect(() => {
    dispatch(setDefaultWrapFinish());
  }, [dispatch]);

  useEffect(() => {
    // No additional logic needed here as useSpring tracks cartItem changes.
  }, [cartItem]);

  // Check for variants when enableVariantSelection is true (with local caching)
  useEffect(() => {
    if (enableVariantSelection && product) {
      const checkForVariants = async () => {
        try {
          const categoryId = product.specificCategory || product.category?._id;
          if (!categoryId) return;

          // Check if we have cached data for this category
          if (getVariantCache.has(categoryId)) {
            const cachedData = getVariantCache.get(categoryId);
            setVariants(cachedData.variants || []);
            setHasVariants(cachedData.variants && cachedData.variants.length > 1);
            setIsLoadingVariants(false);
            return;
          }

          // Set loading state before API call
          setIsLoadingVariants(true);

          // Fetch from API if not cached
          const response = await fetch(`/api/features/get-variants?categoryId=${categoryId}`);
          const data = await response.json();

          // Store in cache
          getVariantCache.set(categoryId, data);

          setVariants(data.variants || []);
          setHasVariants(data.variants && data.variants.length > 1);
        } catch (error) {
          console.error("Error checking variants:", error);
          setVariants([]);
          setHasVariants(false);
        } finally {
          setIsLoadingVariants(false);
        }
      };
      checkForVariants();
    }
  }, [enableVariantSelection, getVariantCache, product]);

  // --- INVENTORY / STOCK MANAGEMENT ---
  // Determine the inventory data source: product inventoryData takes precedence, else selectedOption inventoryData.
  const inventoryData = product.inventoryData || (product.selectedOption && product.selectedOption?.inventoryData) || null;
  let maxAllowed = Infinity;
  let isLimited = false;
  
  if (inventoryData) {
    const { availableQuantity, reorderLevel } = inventoryData;
    isLimited = true;
    
    if (availableQuantity <= 0) {
      // No stock available - disable
      maxAllowed = 0;
    } else {
      // Any available stock - allow customers to buy all available quantity
      maxAllowed = availableQuantity;
    }
  }
  // For convenience, get the current quantity from the cart (or zero)
  const currentQuantity = cartItem ? cartItem.quantity : 0;

  // Function to navigate to cart or show cart drawer
  const goToCart = () => {
    dispatch(openCartDrawer());
  };

  // Toast handlers
  const handleViewSimilar = () => {
    setShowSimilarToast(false);
    dispatch(openRecommendationDrawer({ product: toastProduct }));
  };

  const handleCloseToast = () => {
    setShowSimilarToast(false);
  };

  // Variant selection handlers
  const handleVariantClick = pageSlug => {
    const category = product.category;
    dispatch(setPageSlug({ categoryId: category._id, pageSlug: pageSlug }));
    router.push(`/shop${pageSlug}`);
    setShowVariantDialog(false);
  };

  const handleChooseVariant = e => {
    e.stopPropagation();
    setShowVariantDialog(true);
  };

  const handleAdd = async e => {
    e.stopPropagation(); // Prevent parent onClick
    
    // Check: if limited and adding one would exceed maxAllowed, do nothing.
    if (isLimited && (currentQuantity + 1) > maxAllowed) {
      return;
    }

    // Check if cart is empty before adding
    const wasCartEmpty = cartItems.length === 0;

    setLastAction("increment");
    dispatch(
      addItem({
        productId: product._id,
        productDetails: product,
        insertionDetails,
      })
    );

    // Show similar products toast if cart was empty and product has designGroupId
    if (!hideRecommendationPopup && wasCartEmpty && product.designGroupId) {
      dispatch(openRecommendationDrawer({ product }));

      // setToastProduct(product);
      // setShowSimilarToast(true);

      // // Auto-hide toast after 5 seconds
      // setTimeout(() => {
      //   setShowSimilarToast(false);
      // }, 5000);
    }

    // Track AddToCart event
    try {
      await trackAddToCart(product);
    } catch (error) {
      console.error("AddToCart tracking failed:", error);
      // Do not interfere with user experience
    }
  };

  const handleIncrement = async e => {
    e.stopPropagation();
    
    // If in limited mode and already at max allowed, do not increment.
    if (isLimited && currentQuantity >= maxAllowed) {
      return;
    }

    setLastAction("increment");
    dispatch(incrementQuantity({ productId: product._id }));

    // Track AddToCart event (increment)
    try {
      await trackAddToCart(product);
    } catch (error) {
      console.error("AddToCart tracking failed:", error);
      // Do not interfere with user experience
    }
  };

  const handleDecrement = async e => {
    e.stopPropagation();
    setLastAction("decrement");
    if (cartItem.quantity === 1) {
      dispatch(removeItem({ productId: product._id }));
    } else {
      dispatch(decrementQuantity({ productId: product._id }));
    }
  };

  // Construct the main container's className for the in-cart quantity control.
  const mainClasses = [
    styles.main,
    isBlackButton ? styles.blackButton : "",
    isLarge ? styles.largeButton : "",
    smaller ? styles.smaller : "",
  ]
    .join(" ")
    .trim();

    if (!showOnlyChooseVariants && enableVariantSelection && isLoadingVariants) {
      return (
        <Box width="10rem">
          <Skeleton
            variant="rectangular"
            width="100%"
            height="2.2rem"
            sx={{
              borderRadius: "0.4rem",
              backgroundColor: "rgba(66, 66, 66, 0.3)",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          />
        </Box>
      );
    }

  if ((!enableVariantSelection || !hasVariants) && cartItem) {
    return (
      <div className={mainClasses} onClick={e => e.stopPropagation()}>
        <button onClick={handleDecrement} className={styles.decrement}>
          <RemoveIcon fontSize="1rem" />
        </button>
        <animated.div
          onClick={e => e.stopPropagation()}
          style={{
            transform: props.scale.to(s => `scale(${s})`),
            color: props.color,
            opacity: props.opacity,
          }}
          className={styles.quantity}
        >
          {cartItem.quantity}
        </animated.div>
        <button
          onClick={handleIncrement}
          className={styles.increment}
          disabled={isLimited && currentQuantity >= maxAllowed}
          title={isLimited && currentQuantity >= maxAllowed ? "Maximum quantity reached for this item" : ""}
        >
          <AddIcon fontSize="1rem" />
        </button>
      </div>
    );
  }

  // Construct the Add to Cart button's className for when the product is not in the cart.
  const addToCartClasses = [
    styles.main,
    styles.addToCart,
    isBlackButton ? styles.blackButton : "",
    isLarge ? styles.largeButton : "",
  ]
    .join(" ")
    .trim();

  if (showOnlyChooseVariants && (!enableVariantSelection || !hasVariants)) return null;

  return (
    <>
      <button
        onClick={enableVariantSelection && hasVariants ? handleChooseVariant : handleAdd}
        className={addToCartClasses}
        style={{ outline: "none", border: "none" }}
        disabled={isLimited && currentQuantity + 1 > maxAllowed}
      >
        <span>{enableVariantSelection && hasVariants ? "Choose Variant" : "Add to cart"}</span>
      </button>

      {/* Variant Selection Dialog */}
      {showVariantDialog && (
        <VariantSelectionDialog
          variants={variants}
          product={product}
          onClose={() => setShowVariantDialog(false)}
          onVariantClick={handleVariantClick}
        />
      )}

      {/* Similar Products Toast - Embedded in ProductCard */}
      <SimilarProductsToast
        isVisible={showSimilarToast}
        onClose={handleCloseToast}
        onViewSimilar={handleViewSimilar}
        embedded={true}
      />
    </>
  );
}

// Variant Selection Dialog Component with Letter Mapping Support
const VariantSelectionDialog = ({ variants, product, onClose, onVariantClick }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const [useMapping, setUseMapping] = useState(false);
  const [letterMappingGroups, setLetterMappingGroups] = useState([]);
  const [mappingSelections, setMappingSelections] = useState({});
  const [variantProducts, setVariantProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  const dispatch = useDispatch();

  // Check if category uses letter mapping
  useEffect(() => {
    const fetchVariantProducts = async () => {
      if (!product.designGroupId) return;
      
      setIsLoadingProducts(true);
      try {
        // Fetch products for each variant category with inventory data
        const response = await fetch(
          `/api/products/by-design-group-and-category?designGroupId=${product.designGroupId}&categoryId=${product.category._id}&includeInventory=true`
        );
        const data = await response.json();
        setVariantProducts(data.products);
      } catch (error) {
        console.error("Error fetching variant products:", error);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchVariantProducts();
    
    if (product.category?.useLetterMapping) {
      setUseMapping(true);
      setLetterMappingGroups(product.category.letterMappingGroups || []);
    }
  }, [product, variants]);

  // Handle letter-mapping changes
  const handleMappingChange = (groupName, letterCode) => {
    const newSelections = {
      ...mappingSelections,
      [groupName]: letterCode,
    };
    setMappingSelections(newSelections);

    // Check if all selections are made and find matching product
    let allSelectionsMade = true;
    let finalCode = product.category.specificCategoryCode || "";
    
    for (const group of letterMappingGroups) {
      const chosenLetter = newSelections[group.groupName];
      if (!chosenLetter) {
        allSelectionsMade = false;
        break;
      }
      finalCode += chosenLetter;
    }
    
    
    if (allSelectionsMade) {
      const matchingProduct = variantProducts.find(p => 
        p.variantCode?.toLowerCase() === finalCode.toLowerCase()
      );
      
      // Find the matching variant from variants array
      const matchingVariant = variants.find(v => 
        v.variantCode?.toLowerCase() === finalCode.toLowerCase()
      );
      
      // Find the actual product that has this variant
      if (matchingVariant) {
        const productWithVariant = variantProducts.find(p => 
          p.variant?._id === matchingVariant.id
        );
        setPreviewProduct(productWithVariant || null);
      } else {
        setPreviewProduct(null);
      }
    } else {
      setPreviewProduct(null);
    }
  };

  // Build final variant code and navigate for letter-mapping
  const handleMappingSubmit = () => {
    const category = product.category;
    let finalCode = category.specificCategoryCode || "";

    for (const group of letterMappingGroups) {
      const chosenLetter = mappingSelections[group.groupName];
      if (!chosenLetter) {
        alert(`Please choose an option for ${group.groupName}`);
        return;
      }
      finalCode += chosenLetter;
    }

    // Find the variant with the corresponding variant code
    const matchedVariant = variants.find(variant => variant.variantCode?.toLowerCase() === finalCode.toLowerCase());

    if (!matchedVariant) {
      alert("Variant not found for the selected options.");
      return;
    }

    // Navigate using matched variant's pageSlug
    const finalSlug = `/shop${matchedVariant.pageSlug}`;
    dispatch(setPageSlug({ categoryId: category._id, pageSlug: finalSlug }));
    onVariantClick(matchedVariant.pageSlug);
  };

  const getCategoryName = () => {
    const categoryName = product?.category?.name;
    if (categoryName === "Tank Wraps") {
      return "Tank Size";
    }
    return categoryName || "Variant";
  };

  return (
    <Dialog
      open={true}
      fullWidth
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: "20px",
          padding: "1rem",
          maxWidth: "600px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.2)",
        },
      }}
    >
      <DialogContent
        onClick={e => e.stopPropagation()}
        sx={{
          padding: "2rem 0.5rem 1rem 0.5rem",
          // backgroundColor: "#e2e2e2",
          "@media (max-width: 600px)": {
            padding: "0rem",
          },
        }}
      >
        {/* Main Dialog Heading */}
        <Box
          sx={{
            fontFamily: "Jost, sans-serif",
            fontSize: "2.4rem",
            fontWeight: 400,
            textAlign: "center",
            padding: "1rem 0",
            textDecoration: "underline",
            textUnderlineOffset: "8px",
            textDecorationThickness: "2px",
            textDecorationColor: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            "@media (max-width: 600px)": {
              fontSize: "2rem",
              padding: "0.75rem 0",
              textUnderlineOffset: "8px",
              textDecorationThickness: "1.2px",
            },
          }}
        >
          CHOOSE
        </Box>

        {/* Category Name */}
        <Box
          sx={{
            fontSize: "1.5rem",
            marginTop: "1rem",
            textAlign: "center",
            color: "#000",
            marginBottom: "1rem",
            "@media (max-width: 600px)": {
              fontWeight: 300,
              fontSize: "1rem",
            },
          }}
        >
          {getCategoryName()}
        </Box>

        {/* Render Letter Mapping or Normal Variants */}
        {useMapping ? (
          // Letter Mapping Interface (same as ChangeVariantButton)
          <>
            {letterMappingGroups.map(group => (
              <Box key={group.groupName} sx={{ marginBottom: "2rem" }}>
                <div style={{ fontWeight: "500", textAlign: "center" }}>{group.groupName}</div>

                <Box
                  sx={{
                    display: "flex",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  {group.mappings.map(option => (
                    <Box
                      key={option.letterCode}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        cursor: "pointer",
                        borderRadius: "8px",
                        padding: "0.5rem",
                      }}
                      onClick={(e) => {e.stopPropagation();handleMappingChange(group.groupName, option.letterCode)}}
                    >
                      {group.thumbnailRequired && option.thumbnail && (
                        <Image
                          src={
                            option.thumbnail.startsWith("/")
                              ? `${baseImageUrl}${option.thumbnail}`
                              : `${baseImageUrl}/${option.thumbnail}`
                          }
                          alt={option.name}
                          width={400}
                          height={400}
                          style={{
                            objectFit: "cover",
                            borderRadius: "4px",
                            marginBottom: "0.5rem",
                            width: "100px",
                            height: "auto",
                          }}
                        />
                      )}

                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={mappingSelections[group.groupName] === option.letterCode}
                            onChange={() => handleMappingChange(group.groupName, option.letterCode)}
                          />
                        }
                        label={option.name}
                        sx={{
                          margin: 0,
                          "& .MuiFormControlLabel-label": {
                            fontSize: "0.9rem",
                          },
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}

            {/* Preview Product */}
            {previewProduct && (
              <Box sx={{ marginTop: "2rem" }}>
                <Typography
                  variant="h6"
                  sx={{
                    textAlign: "center",
                    fontWeight: "500",
                    marginBottom: "1rem",
                    fontFamily: "Jost, sans-serif",
                  }}
                >
                  Preview
                </Typography>
                <SimpleVariantCard 
                  variant={previewProduct?.variant} 
                  product={previewProduct} 
                  onClose={onClose} 
                />
              </Box>
            )}
          </>
        ) : (
          // Normal Variants List
          <Box display="flex" flexDirection="column" gap="1rem">
            {isLoadingProducts ? (
              // Loading skeletons
              Array.from({ length: 3 }).map((_, index) => (
                <Box key={index} sx={{ padding: "1rem" }}>
                  <Skeleton variant="rectangular" width="100%" height="150px" sx={{ borderRadius: "8px", mb: 2 }} />
                  <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
                  <Skeleton variant="text" width="40%" height={20} sx={{ mb: 2 }} />
                  <Skeleton variant="rectangular" width="100%" height="44px" sx={{ borderRadius: "0.4rem" }} />
                </Box>
              ))
            ) : variantProducts && variantProducts.length > 0 ? (
              variantProducts.map((variantProduct, index) => (
                <Box key={variantProduct._id}>
                  <SimpleVariantCard 
                    variant={variants.find(v => v.variantCode?.toLowerCase() === variantProduct.variantCode?.toLowerCase())} 
                    product={variantProduct} 
                    onClose={onClose} 
                  />
                  {/* Divider */}
                  {index !== variantProducts.length - 1 && <Divider style={{ marginTop: "20px", borderColor: "black" }} />}
                </Box>
              ))
            ) : (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography>No variants available</Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Simple Variant Card Component
const SimpleVariantCard = ({ variant, product, onClose }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // Handle card click to redirect to product page
  const handleCardClick = () => {
    if (product.pageSlug) {
      window.open(`https://www.maddycustom.com/shop${product.pageSlug}`, '_blank');
    }
  };

  // Check if product is out of stock
  const inventoryData = product.inventoryData;
  const isOutOfStock = inventoryData ? inventoryData.availableQuantity <= 0 : false;

  return (
    <Box
      onClick={handleCardClick}
      sx={{
        borderRadius: "0.5rem",
        padding: "1rem",
        backgroundColor: "#fff",
        boxShadow: "0px 2px 6px rgba(0,0,0,0.1)",
        position: "relative",
        cursor: "pointer",
        "&:hover": {
          boxShadow: "0px 4px 12px rgba(0,0,0,0.15)",
          transform: "translateY(-2px)",
        },
        transition: "all 0.2s ease",
      }}
    >
      {product.images && product.images.length > 0 && (
        <Box
          sx={{ position: 'relative' }}
        >
          <Box
            component="img"
            src={product.images[0].startsWith("/") ? baseImageUrl + product.images[0] : baseImageUrl + "/" + product.images[0]}
            alt={product.name}
            style={{
              width: "100%",
              height: "150px",
              objectFit: "cover",
              borderRadius: "8px",
              marginBottom: "1rem",
              filter: isOutOfStock ? 'grayscale(100%) brightness(1.3)' : 'none',
              opacity: isOutOfStock ? 0.7 : 1
            }}
          />
          {isOutOfStock && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#cc0000',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                fontWeight: '600',
                fontSize: '0.9rem',
                fontFamily: 'Jost, sans-serif',
                textAlign: 'center',
                zIndex: 1
              }}
            >
              Out of Stock
            </Box>
          )}
        </Box>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
        <Box>
          <Typography
            variant="body2"
            sx={{
              color: "#666",
              fontFamily: "Jost, sans-serif",
              fontSize: "0.9rem",
            }}
          >
            {variant?.variantInfo || product.variant?.variantInfo || product.description}
          </Typography>
        </Box>
      </Box>

      {/* Only show AddToCartButton if not out of stock */}
      {!isOutOfStock && (
        <AddToCartButton
          product={product}
          isBlackButton={true}
          smaller={false}
          enableVariantSelection={false}
          hideRecommendationPopup
        />
      )}
    </Box>
  );
};
