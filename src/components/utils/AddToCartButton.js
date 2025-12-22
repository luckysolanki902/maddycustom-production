"use client";

import React, { useEffect, useState } from "react";
import usePageType from "@/hooks/usePageType";
import { useDispatch, useSelector } from "react-redux";
import { useSpring, animated } from "react-spring";
import styles from "./styles/addtocartbutton.module.css";
import RemoveIcon from "@mui/icons-material/Remove";
import AddIcon from "@mui/icons-material/Add";
import { addItem, incrementQuantity, decrementQuantity, removeItem, setDefaultWrapFinish } from "../../store/slices/cartSlice";
import { openCartDrawer, openRecommendationDrawer, markRecommendationDrawerSeen } from "../../store/slices/uiSlice";
import { setVariantsCache, setPendingRequest, clearPendingRequest, removeExpiredCache } from "../../store/slices/variantsSlice";
import { selectIsSubscribedToNotification } from "../../store/slices/notificationSlice";
import { addToCart as trackAddToCart } from "@/lib/metadata/facebookPixels";
import { gaAddToCart } from "@/lib/metadata/googleAds";
import funnelClient from "@/lib/analytics/funnelClient";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SimilarProductsToast from "../notifications/SimilarProductsToast";
import NotifyMeDialog from "../dialogs/NotifyMeDialog";
import { Dialog, DialogContent, Box, Typography, Divider, Button, Checkbox, FormControlLabel, Skeleton, Chip, IconButton, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { setPageSlug } from "../../store/slices/variantPreferenceSlice";
import Image from "next/image";
import cvStyles from "../page-sections/products-page/styles/changevariantbutton.module.css";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

// Request manager for deduplicating API calls
const variantRequestManager = (() => {
  const pendingRequests = new Map();

  return {
    async getVariants(categoryId, dispatch) {
      // If there's already a pending request for this categoryId, wait for it
      if (pendingRequests.has(categoryId)) {
        return await pendingRequests.get(categoryId);
      }

      // Create new request
      const requestPromise = (async () => {
        try {
          dispatch(setPendingRequest({ categoryId }));

          const response = await fetch(`/api/features/get-variants?categoryId=${categoryId}`);
          const data = await response.json();

          // Store in Redux cache
          dispatch(setVariantsCache({ categoryId, data }));

          return data;
        } catch (error) {
          console.error("Error fetching variants:", error);
          dispatch(clearPendingRequest({ categoryId }));
          throw error;
        } finally {
          // Clean up pending request
          pendingRequests.delete(categoryId);
        }
      })();

      // Store the promise so other components can wait for it
      pendingRequests.set(categoryId, requestPromise);

      return await requestPromise;
    }
  };
})();

export default function AddToCartButton({
  product,
  isBlackButton = false,
  isLarge = false,
  smaller = false,
  insertionDetails: insertionDetailsProp = {},
  enableVariantSelection = false,
  hideRecommendationPopup = false,
  showOnlyChooseVariants = false,
  disableRecommendationTrigger = false,
  flexResponsiveness = false,
  disableNotifyMe = false, // New prop to disable notify functionality for POD items
  fuelAddonStyle = false, // custom condensed styling for FuelCapWrapAddOns
  customAddText = null, // Custom text for add button (e.g., "Add to Order")
  customVariantText = null, // Custom text for variant button (e.g., "Select & Add")
  drawerPrimary = false, // Larger button for hero card in recommendation drawer
  drawerSecondary = false, // Smaller button for secondary cards in recommendation drawer
}) {
  // Use custom hook to classify pageType if not provided
  const pageType = usePageType();
  const insertionDetails = { ...insertionDetailsProp, pageType: insertionDetailsProp.pageType || pageType };
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart.items);
  const utmDetails = useSelector(state => state.utm?.utmDetails);
  const hasSeenRecommendationDrawer = useSelector(state => state.ui.hasSeenRecommendationDrawer);
  const lastRecommendationShownTime = useSelector(state => state.ui.lastRecommendationShownTime);
  const recommendationCooldownDuration = useSelector(state => state.ui.recommendationCooldownDuration);
  const cartItem = cartItems.find(item => item.productId === product._id);
  const variantsCache = useSelector(state => state.variants.cache);
  const cacheTimestamps = useSelector(state => state.variants.lastUpdated);
  const pendingRequests = useSelector(state => state.variants.pendingRequests);

  // Check if user is already subscribed to notifications for this product
  const isSubscribedToNotification = useSelector(selectIsSubscribedToNotification(product, product.selectedOption));

  // State to track last action for animation
  const [lastAction, setLastAction] = useState(null); // 'increment' or 'decrement'

  // State for similar products toast
  const [showSimilarToast, setShowSimilarToast] = useState(false);
  const [toastProduct, setToastProduct] = useState(null);

  // Variant selection state
  const [variants, setVariants] = useState([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [isLoadingVariants, setIsLoadingVariants] = useState(true);
  
  // Notify me dialog state
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  
  // Matching products count for recommendation button
  const [matchingCount, setMatchingCount] = useState(0);
  
  const router = useRouter();
  
  // Debug log for notify dialog state
  if (showNotifyDialog) {
    console.log('showNotifyDialog state:', showNotifyDialog);
  }
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
    // Only run once on mount, and only if there are cart items that need default wrap finish
    const hasWrapsWithoutFinish = cartItems.some(item => {
      const categoryName = item.productDetails?.category?.name?.toLowerCase();
      return (categoryName?.includes('wrap') || categoryName?.includes('Wrap')) && !item.productDetails?.wrapFinish;
    });
    if (hasWrapsWithoutFinish) {
      dispatch(setDefaultWrapFinish());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  const getCartSnapshot = (quantityDelta = 0, valueDelta = 0) => {
    try {
      const totals = cartItems.reduce(
        (acc, item) => {
          const price = item.price ?? item.productDetails?.price ?? 0;
          const qty = item.quantity || 0;
          acc.items += qty;
          acc.value += price * qty;
          return acc;
        },
        { items: 0, value: 0 }
      );
      return {
        items: totals.items + quantityDelta,
        value: Math.max(0, totals.value + valueDelta),
        currency: 'INR',
      };
    } catch (error) {
      return undefined;
    }
  };

  const buildProductPayload = (quantity = 1) => ({
    id: product._id,
    name: product.name,
    price: product.price,
    quantity,
    variantId: product.selectedOption?._id,
    brand: product.brand,
    category: product.category?.name || product.category,
  });



  // Check for variants when enableVariantSelection is true (with Redux caching and request deduplication)
  useEffect(() => {
    if (enableVariantSelection && product) {
      const checkForVariants = async () => {
        try {
          const categoryId = product.specificCategory || product.category?._id;
          if (!categoryId) {
            setIsLoadingVariants(false);
            return;
          }

          // Clean expired cache first
          dispatch(removeExpiredCache());

          // Check if we have cached data for this category
          const cachedData = variantsCache[categoryId];
          const cacheTime = cacheTimestamps[categoryId];
          const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

          if (cachedData && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION) {
            setVariants(cachedData.variants || []);
            setHasVariants(cachedData.variants && cachedData.variants.length > 1);
            setIsLoadingVariants(false);
            return;
          }

          // Set loading state when we need to fetch data
          setIsLoadingVariants(true);

          // Check if there's already a pending request for this category
          if (pendingRequests[categoryId]) {
            // Wait for ongoing request to complete by checking cache again after a delay
            const checkCacheAgain = () => {
              const newCachedData = variantsCache[categoryId];
              if (newCachedData) {
                setVariants(newCachedData.variants || []);
                setHasVariants(newCachedData.variants && newCachedData.variants.length > 1);
                setIsLoadingVariants(false);
              } else {
                // If still no data, try again after a short delay
                setTimeout(checkCacheAgain, 100);
              }
            };
            setTimeout(checkCacheAgain, 100);
            return;
          }

          // Use the request manager to fetch data (handles deduplication)
          const data = await variantRequestManager.getVariants(categoryId, dispatch);

          setVariants(data.variants || []);
          setHasVariants(data.variants && data.variants.length > 1);
          setIsLoadingVariants(false); // Move this inside try block, not finally
        } catch (error) {
          console.error("Error checking variants:", error);
          setVariants([]);
          setHasVariants(false);
          setIsLoadingVariants(false); // Also set false on error
        }
      };
      checkForVariants();
    } else if (!enableVariantSelection) {
      // If variant selection is disabled, immediately set loading to false
      setIsLoadingVariants(false);
    }
  }, [enableVariantSelection, product, dispatch, variantsCache, cacheTimestamps, pendingRequests]);

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

  // Helper function to check if recommendation is in cooldown
  const isRecommendationInCooldown = () => {
    if (!lastRecommendationShownTime) return false;
    const timeSinceLastShown = Date.now() - lastRecommendationShownTime;
    return timeSinceLastShown < recommendationCooldownDuration;
  };

  // Decide if we should show recommendation trigger (button) for this product
  // Show manual button whenever the product has a designGroupId (unless explicitly disabled/hidden)
  const showRecoButton = (
    cartItem &&
    product?.designGroupId &&
    !hideRecommendationPopup &&
    !disableRecommendationTrigger
  );

  // Fetch matching products count when button should show
  useEffect(() => {
    if (showRecoButton && product?.designGroupId && matchingCount === 0) {
      const fetchMatchingCount = async () => {
        try {
          const response = await fetch(`/api/products/by-design-group/${product.designGroupId}`);
          const data = await response.json();
          if (data.success && data.products) {
            // Exclude current product from count
            const count = data.products.filter(p => p._id !== product._id).length;
            setMatchingCount(Math.min(count, 9)); // Cap at 9 for display
          }
        } catch (error) {
          console.error("Error fetching matching count:", error);
        }
      };
      fetchMatchingCount();
    }
  }, [showRecoButton, product?.designGroupId, product?._id, matchingCount]);

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

  // Helper function to check if product is out of stock
  const isProductOutOfStock = () => {
    // If notify functionality is disabled (POD items), never show as out of stock
    if (disableNotifyMe) {
      return false;
    }
    
    // Check if variant/category is not available
    if (!product?.variantDetails?.available || !product?.category?.available) {
      return true;
    }
    
    // Check inventory - using same logic as AddToCartButton's inventory management
    if (inventoryData && inventoryData.availableQuantity <= 0) {
      return true;
    }
    
    // Check if maxAllowed is 0 (no stock available)
    if (maxAllowed === 0) {
      return true;
    }
    
    return false;
  };

  // Notify me handlers
  const handleNotifyMe = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('Notify button clicked, opening dialog...');
    setShowNotifyDialog(true);
  };

  const handleNotifyDialogClose = () => {
    setShowNotifyDialog(false);
  };

  const handleNotifySuccess = () => {
    // Don't close the dialog here - let the user close it manually with the "Done" button
    // Success message is already handled within the NotifyMeDialog component
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

    setLastAction("increment");
    dispatch(
      addItem({
        productId: product._id,
        productDetails: product,
        insertionDetails,
      })
    );

    // Show auto recommendation popup if product has designGroupId and not in cooldown
    if (product?.designGroupId && !hideRecommendationPopup && !disableRecommendationTrigger) {
      const inCooldown = isRecommendationInCooldown();

      if (!inCooldown) {
        // Show auto popup after a short delay to let the add animation complete
        setTimeout(() => {
          dispatch(openRecommendationDrawer({ product }));
        }, 800);
      }
      // If in cooldown, the manual button will be shown via showRecoButton
    }

    // Track AddToCart event
    try {
      await trackAddToCart(product);
      try {
        gaAddToCart({
          items: [{
            productId: product._id,
            name: product.name,
            price: product.price,
            quantity: 1,
            brand: product.brand,
            category: product.category?.name || product.category,
          }],
          value: product.price,
        });
      } catch {}
    } catch (error) {
      console.error("AddToCart tracking failed:", error);
      // Do not interfere with user experience
    }
    try {
      const price = Number(product.price) || 0;
      funnelClient.track('add_to_cart', {
        product: buildProductPayload(1),
        cart: getCartSnapshot(1, price),
        metadata: {
          pageType: insertionDetails.pageType || pageType,
          component: insertionDetails.component || 'AddToCartButton',
          action: 'add',
          source: insertionDetails.source,
        },
        utm: utmDetails,
      });
    } catch (error) {
      // add_to_cart event failed
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

    // Show auto recommendation popup if this is the first increment and product has designGroupId and not in cooldown
    if (currentQuantity === 1 && product?.designGroupId && !hideRecommendationPopup && !disableRecommendationTrigger) {
      const inCooldown = isRecommendationInCooldown();

      if (!inCooldown) {
        // Show auto popup after a short delay to let the add animation complete
        setTimeout(() => {
          dispatch(openRecommendationDrawer({ product }));
        }, 800);
      }
      // If in cooldown, the manual button will be shown via showRecoButton
    }

    // Track AddToCart event (increment)
    try {
      await trackAddToCart(product);
      try {
        gaAddToCart({
          items: [{
            productId: product._id,
            name: product.name,
            price: product.price,
            quantity: 1,
            brand: product.brand,
            category: product.category?.name || product.category,
          }],
          value: product.price,
        });
      } catch {}
    } catch (error) {
      console.error("AddToCart tracking failed:", error);
      // Do not interfere with user experience
    }
    try {
      const price = Number(product.price) || 0;
      funnelClient.track('add_to_cart', {
        product: buildProductPayload(1),
        cart: getCartSnapshot(1, price),
        metadata: {
          pageType: insertionDetails.pageType || pageType,
          component: insertionDetails.component || 'AddToCartButton',
          action: 'increment',
          source: insertionDetails.source,
        },
        utm: utmDetails,
      });
    } catch (error) {
      // add_to_cart increment event failed
    }
  };

  const handleDecrement = async e => {
    e.stopPropagation();
    setLastAction("decrement");
    
    const isRemovingItem = cartItem.quantity === 1;
    const previousQuantity = cartItem.quantity;
    
    if (isRemovingItem) {
      dispatch(removeItem({ productId: product._id }));
    } else {
      dispatch(decrementQuantity({ productId: product._id }));
    }
    
    // Track remove_from_cart funnel event
    try {
      const price = Number(product.price) || 0;
      funnelClient.track('remove_from_cart', {
        product: buildProductPayload(1),
        cart: getCartSnapshot(-1, -price), // Decrement by 1 item and subtract price
        metadata: {
          pageType: insertionDetails.pageType || pageType,
          component: insertionDetails.component || 'AddToCartButton',
          action: isRemovingItem ? 'remove' : 'decrement',
          previousQuantity,
          source: insertionDetails.source,
        },
        utm: utmDetails,
      });
    } catch (error) {
      // remove_from_cart event failed
    }
  };

  // Construct the main container's className for the in-cart quantity control.
  const mainClasses = [
    styles.main,
    isBlackButton ? styles.blackButton : "",
    isLarge ? styles.largeButton : "",
    smaller ? styles.smaller : "",
    fuelAddonStyle ? styles.fuelAddonButton : "",
    drawerPrimary ? styles.drawerPrimary : "",
    drawerSecondary ? styles.drawerSecondary : ""
  ].join(" ").trim();

  if (showOnlyChooseVariants && isLoadingVariants) return null;

  if (isLoadingVariants) {
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
    const outOfStock = isProductOutOfStock();
    
    return (
      <div style={{ display: 'flex', flexDirection: flexResponsiveness ? 'row' : 'column', alignItems: flexResponsiveness ? 'center' : 'flex-start', justifyContent: flexResponsiveness ? 'flex-start' : 'flex-start', gap: flexResponsiveness ? '1rem' : '0' }} onClick={e => e.stopPropagation()}>
        {outOfStock ? (
          // If product is now out of stock, show notify button instead of quantity controls
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isSubscribedToNotification) {
                handleNotifyMe(e);
              }
            }}
            className={`${styles.main} ${styles.notifyButton}`}
            style={{ 
              outline: "none", 
              border: "none",
              background: isSubscribedToNotification 
                ? 'linear-gradient(90deg, #4caf50, #66bb6a)' 
                : 'linear-gradient(90deg, #2d2d2d, #424242)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: 'center',
              marginBottom: showRecoButton ? '.45rem' : 0,
              cursor: isSubscribedToNotification ? 'default' : 'pointer',
              opacity: isSubscribedToNotification ? 0.9 : 1
            }}
          >
            {isSubscribedToNotification ? (
              <>
                <CheckCircleIcon style={{ fontSize: '1rem' }} />
                <span>Notify Me</span>
              </>
            ) : (
              <>
                <NotificationsIcon style={{ fontSize: '1rem' }} />
                <span>Notify Me</span>
              </>
            )}
          </button>
        ) : (
          // Show quantity controls if still in stock
          <div className={mainClasses} style={{ marginBottom: showRecoButton ? '.45rem' : 0 }}>
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
        )}
        {showRecoButton && (
          <button
            data-clarity="see-matching-picks"
            type="button"
            onClick={(e) => { e.stopPropagation(); dispatch(openRecommendationDrawer({ product })); }}
            style={{
              background: 'linear-gradient(135deg, #faf8f5 0%, #fff 100%)',
              border: '1px solid #e8e4df',
              color: '#2d2d2d',
              fontFamily: 'Jost, sans-serif',
              fontSize: '.78rem',
              padding: '.55rem 1rem',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '.4rem',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              transition: 'all .2s ease',
            }}
            className="mc-reco-trigger-btn"
          >
            <span style={{ fontSize: '0.6rem', color: '#8b7355', lineHeight: 1 }}>◆</span>
            <span style={{ fontWeight: 500 }}>{matchingCount > 0 ? `+${matchingCount} More in Set` : 'View Set'}</span>
            <span style={{ fontSize: '0.65rem', color: '#999', marginLeft: '2px' }}>›</span>
          </button>
        )}
      </div>
    );
  }

  // Construct the Add to Cart button's className for when the product is not in the cart.
  const addToCartClasses = [
    styles.main,
    styles.addToCart,
    isBlackButton ? styles.blackButton : "",
    isLarge ? styles.largeButton : "",
    fuelAddonStyle ? styles.fuelAddonButton : "",
    drawerPrimary ? styles.drawerPrimary : "",
    drawerSecondary ? styles.drawerSecondary : ""
  ].join(" ").trim();

  if (showOnlyChooseVariants && (!enableVariantSelection || !hasVariants)) return null;

  // Check if product is out of stock
  const outOfStock = isProductOutOfStock();

  return (
    <>
      <div style={{ display: 'flex', flexDirection: flexResponsiveness ? 'row' : 'column', alignItems: flexResponsiveness ? 'center' : 'flex-start', gap: flexResponsiveness ? '1rem' : '.5rem' }} onClick={e => e.stopPropagation()}>
        {outOfStock ? (
          // Show Notify Me button for out of stock products
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isSubscribedToNotification) {
                handleNotifyMe(e);
              }
            }}
            className={`${styles.main} ${styles.notifyButton}`}
            style={{ 
              outline: "none", 
              border: "none",
              background: isSubscribedToNotification 
                ? 'linear-gradient(90deg, #4caf50, #66bb6a)' 
                : 'linear-gradient(90deg, #2d2d2d, #424242)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: 'center',
              cursor: isSubscribedToNotification ? 'default' : 'pointer',
              opacity: isSubscribedToNotification ? 0.9 : 1
            }}
          >
            {isSubscribedToNotification ? (
              <>
                <CheckCircleIcon style={{ fontSize: '1rem' }} />
                <span>Notify Me</span>
              </>
            ) : (
              <>
                <NotificationsIcon style={{ fontSize: '1rem' }} />
                <span>Notify Me</span>
              </>
            )}
          </button>
        ) : (
          // Show regular Add to Cart button for available products
          <button
            onClick={enableVariantSelection && hasVariants ? handleChooseVariant : handleAdd}
            className={addToCartClasses}
            style={{ outline: "none", border: "none" }}
            disabled={isLimited && currentQuantity + 1 > maxAllowed}
          >
            <span>{enableVariantSelection && hasVariants 
              ? (customVariantText || "Select & Add") 
              : (customAddText || "Add to cart")}</span>
          </button>
        )}

        {showRecoButton && (
          <button
            type="button"
            data-clarity="see-matching-picks"
            onClick={(e) => { e.stopPropagation(); dispatch(openRecommendationDrawer({ product })); }}
            style={{
              background: 'linear-gradient(135deg, #faf8f5 0%, #fff 100%)',
              border: '1px solid #e8e4df',
              color: '#2d2d2d',
              fontFamily: 'Jost, sans-serif',
              fontSize: '.78rem',
              padding: '.55rem 1rem',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '.4rem',
              cursor: 'pointer',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              transition: 'all .2s ease',
            }}
            className="mc-reco-trigger-btn"
          >
            <span style={{ fontSize: '0.6rem', color: '#8b7355', lineHeight: 1 }}>◆</span>
            <span style={{ fontWeight: 500 }}>{matchingCount > 0 ? `+${matchingCount} More in Set` : 'View Set'}</span>
            <span style={{ fontSize: '0.65rem', color: '#999', marginLeft: '2px' }}>›</span>
          </button>
        )}
      </div>

      {/* Variant Selection Dialog */}
      {showVariantDialog && (
        <VariantSelectionDialog
          variants={variants}
          product={product}
          onClose={() => setShowVariantDialog(false)}
          onVariantClick={handleVariantClick}
          insertionDetails={insertionDetails}
        />
      )}

      {/* Similar Products Toast - Embedded in ProductCard */}
      <SimilarProductsToast
        isVisible={showSimilarToast}
        onClose={handleCloseToast}
        onViewSimilar={handleViewSimilar}
        embedded={true}
      />

      {/* Notify Me Dialog */}
      <NotifyMeDialog
        open={showNotifyDialog}
        onClose={handleNotifyDialogClose}
        product={product}
        selectedOption={product.selectedOption}
        onSuccess={handleNotifySuccess}
      />
    </>
  );
}

// Variant Selection Dialog Component with Letter Mapping Support
const VariantSelectionDialog = ({ variants, product, onClose, onVariantClick, insertionDetails = {} }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const [useMapping, setUseMapping] = useState(false);
  const [letterMappingGroups, setLetterMappingGroups] = useState([]);
  const [mappingSelections, setMappingSelections] = useState({});
  const [variantProducts, setVariantProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [previewProduct, setPreviewProduct] = useState(null);
  const [isMappingFinalized, setIsMappingFinalized] = useState(false);
  const [finalSelections, setFinalSelections] = useState({});
  const [selectedVariantCode, setSelectedVariantCode] = useState(null);
  const dispatch = useDispatch();

  // Check if category uses letter mapping
  useEffect(() => {
    if (product.category?.useLetterMapping) {
      setUseMapping(true);
      setLetterMappingGroups(product.category.letterMappingGroups || []);
    }
  }, [product]);

  // Fetch products filtered by selected variant code
  useEffect(() => {
    if (!selectedVariantCode) return;

    const fetchVariantProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const productName = product.name;
        const categoryId = product.specificCategory ?? product.category?._id;

        // Fetch products filtered by variantCode like FuelCapWrapAddOns does
        const response = await fetch(
          `/api/products/by-category-and-name?productName=${productName}&categoryId=${categoryId}&variantCode=${selectedVariantCode}&includeInventory=true`
        );
        const data = await response.json();
        
        setVariantProducts(data.products || []);
        // Set preview to first product if available
        if (data.products && data.products.length > 0) {
          setPreviewProduct(data.products[0]);
        }
      } catch (error) {
        console.error("Error fetching variant products:", error);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    fetchVariantProducts();
  }, [selectedVariantCode, product]);

  // Handle letter-mapping changes (live preview as user selects)
  const handleMappingChange = (groupName, letterCode) => {
    const newSelections = {
      ...mappingSelections,
      [groupName]: letterCode,
    };
    setMappingSelections(newSelections);

    // Check if all selections are made
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

    // If all selections made, update the selected variant code
    if (allSelectionsMade) {
      setSelectedVariantCode(finalCode);
    } else {
      setPreviewProduct(null);
      setSelectedVariantCode(null);
    }
  };

  // Build final variant code and trigger product fetch
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
    
    // Find matching variant from variants array
    const matchedVariant = variants.find(v => v.variantCode?.toLowerCase() === finalCode.toLowerCase());

    if (!matchedVariant) {
      alert("Variant not found for the selected options.");
      return;
    }

    // Update selected variant code - this will trigger product fetch
    setSelectedVariantCode(matchedVariant.variantCode);
    setFinalSelections(mappingSelections);
    setIsMappingFinalized(true);
  };

  const renderSelectedChips = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      <IconButton size="small" onClick={() => setIsMappingFinalized(false)} aria-label="Back to selection">
        <ArrowBackIcon />
      </IconButton>
      {letterMappingGroups.map(group => {
        const letter = finalSelections[group.groupName];
        if (!letter) return null;
        const option = group.mappings.find(o => o.letterCode === letter);
        const label = option ? `${group.groupName}: ${option.name}` : `${group.groupName}: ${letter}`;
        return <Chip key={group.groupName} label={label} />;
      })}
    </Box>
  );

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
          padding: "0px",
          maxWidth: "600px",
          width: "100%",
          maxHeight: "85vh",
          overflow: "hidden",
          boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.2)",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <DialogContent
        onClick={e => e.stopPropagation()}
        sx={{
          flex: 1,
          overflowY: "auto",
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
          {/* {getCategoryName()} */}
          Variant
        </Box>

        {/* Render Letter Mapping or Normal Variants */}
        {useMapping ? (
          !isMappingFinalized ? (
            <>
              <Box sx={{ flex: 1, overflowY: "auto", paddingBottom: "1rem" }}>
                {letterMappingGroups.map(group => (
                  <Box key={group.groupName} sx={{ marginBottom: "2rem" }}>
                    <div style={{ fontWeight: "500", textAlign: "center" }}>{group.groupName}</div>

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                        gap: "0.5rem",
                        justifyItems: "center",
                        "@media (max-width: 600px)": {
                          gridTemplateColumns: "repeat(2, 1fr)",
                        },
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
                            width: "100%",
                            minWidth: "120px",
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            handleMappingChange(group.groupName, option.letterCode);
                          }}
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
                                width: "80px",
                                height: "auto",
                                maxHeight: "80px",
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
                                fontSize: "0.85rem",
                                textAlign: "center",
                              },
                            }}
                          />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Fixed Submit Button Footer */}
              <Box
                sx={{
                  padding: "1rem",
                  borderTop: "1px solid #e0e0e0",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "#fff",
                }}
              >
                <Button
                  variant="contained"
                  onClick={handleMappingSubmit}
                  disabled={isLoadingProducts}
                  sx={{
                    backgroundColor: "black",
                    color: "white",
                    fontSize: "0.9rem",
                    padding: "0.4rem 1.4rem",
                    borderRadius: "0.8rem",
                    "&:hover": {
                      backgroundColor: "rgba(0,0,0,0.8)",
                      transform: "scale(0.98)",
                    },
                    transition: "all 0.3s cubic-bezier(0.39, 0.575, 0.565, 1)",
                  }}
                >
                  Submit
                  {isLoadingProducts && <CircularProgress size={20} sx={{ ml: 1 }} color="white" />}
                </Button>
              </Box>
            </>
          ) : (
            <>
              {renderSelectedChips()}
              {previewProduct ? (
                <SimpleVariantCard
                  variant={variants.find(v => v.variantCode?.toLowerCase() === previewProduct.variantCode?.toLowerCase())}
                  product={previewProduct}
                  onClose={onClose}
                  insertionDetails={insertionDetails}
                />
              ) : (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography>No matching variant found</Typography>
                </Box>
              )}
            </>
          )
        ) : (
          // Normal Variants List
          <Box display="flex" flexDirection="column" gap="1rem">
            {isLoadingProducts ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    gap: { xs: "0.75rem", sm: "1rem" },
                    p: { xs: "0.85rem", sm: "1rem" },
                    background: "#fff",
                    borderRadius: "0.75rem",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                    position: "relative",
                  }}
                >
                  <Skeleton
                    variant="rounded"
                    sx={{
                      width: { xs: 110, sm: 140 },
                      height: { xs: 110, sm: 140 },
                      borderRadius: "0.6rem",
                      flexShrink: 0,
                      background: "linear-gradient(120deg,#f0f0f0,#e8e8e8,#f0f0f0)",
                      backgroundSize: "200% 100%",
                      animation: "mc-skel-shine 1.4s ease-in-out infinite",
                    }}
                  />
                  <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <Skeleton variant="rounded" height={22} width="65%" sx={{ mb: 1, borderRadius: "0.65rem" }} />
                    <Skeleton variant="text" height={16} width="80%" sx={{ mb: 0.5 }} />
                    <Skeleton variant="text" height={16} width="50%" sx={{ mb: 0.5 }} />
                    <Box sx={{ flexGrow: 1 }} />
                    <Skeleton variant="rounded" height={38} width="100%" sx={{ borderRadius: "0.55rem" }} />
                  </Box>
                </Box>
              ))
            ) : variantProducts && variantProducts.length > 0 ? (
              variantProducts.map((variantProduct, index) => (
                <Box key={variantProduct._id}>
                  <SimpleVariantCard
                    variant={variants.find(v => v.variantCode?.toLowerCase() === variantProduct.variantCode?.toLowerCase())}
                    product={variantProduct}
                    onClose={onClose}
                    insertionDetails={insertionDetails}
                  />
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
const SimpleVariantCard = ({ variant, product, onClose, insertionDetails = {} }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // Handle card click to redirect to product page
  const handleCardClick = () => {
    if (product.pageSlug) {
      window.open(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/shop${product.pageSlug}`, "_blank");
    }
  };

  // Prepare display data similar to ChangeVariantButton UI
  const displayName = variant?.name?.toLowerCase().includes("tank")
    ? variant.name.split(" ")[0]
    : (variant?.name || product?.variantDetails?.name || product?.name || "");

  const infoText = (variant?.variantInfo || product?.variantDetails?.variantInfo || "");
  const infoLabel = infoText.includes(":") ? infoText.split(":")[0] : "";
  const infoValue = infoText.includes(":") ? infoText.split(":")[1] : infoText;

  // Always use product images, not variant images
  const variantImage = product?.images && product.images[0]
    ? (product.images[0].startsWith("/") ? baseImageUrl + product.images[0] : baseImageUrl + "/" + product.images[0])
    : (variant?.image
      ? (variant.image.startsWith("/") ? baseImageUrl + variant.image : baseImageUrl + "/" + variant.image)
      : null);

  // Determine out-of-stock like ProductCard
  const getDisplayImage = (p) => {
    let outOfStock = !p?.variantDetails?.available || !p?.category?.available;

    if (p.images && p.images.length > 0) {
      outOfStock = outOfStock || p.inventoryData?.availableQuantity === 0;
      return { imageUrl: p.images[0], outOfStock };
    }

    if (p.options && p.options.length > 0) {
      for (const option of p.options) {
        if (option.images && option.images.length > 0) {
          outOfStock = outOfStock || option.inventoryData?.availableQuantity === 0;
          return { imageUrl: option.images[0], outOfStock };
        }
      }
    }

    return { imageUrl: null, outOfStock: true };
  };
  const { outOfStock } = getDisplayImage(product);

  return (
    <Box
      onClick={handleCardClick}
      className={cvStyles.variantBox}
      sx={{
        cursor: 'pointer',
        borderRadius: '0.75rem',
        p: { xs: '0.85rem', sm: '1rem' },
        backgroundColor: '#fff!important',
        boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'row',
        gap: { xs: '0.75rem', sm: '1rem' },
        alignItems: 'stretch',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow .25s ease, transform .25s ease',
        '&:hover': {
          boxShadow: '0 4px 14px -2px rgba(0,0,0,0.18)',
          transform: 'translateY(-2px)'
        }
      }}
    >
      {/* Left Image */}
      {variantImage && (
        <Box
          sx={{
            position: 'relative',
            flexShrink: 0,
            width: { xs: 110, sm: 140 },
            borderRadius: '0.6rem',
            overflow: 'hidden',
            background: '#f5f5f5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Image
            src={variantImage}
            alt={product.name}
            fill
            sizes="(max-width: 600px) 110px, 140px"
            style={{ objectFit: 'cover', filter: outOfStock ? 'grayscale(100%)' : 'none', opacity: outOfStock ? 0.9 : 1 }}
            className={cvStyles.customImg}
          />
          {outOfStock && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.28)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '.78rem',
                fontWeight: 700,
                letterSpacing: .6,
                textTransform: 'uppercase'
              }}
            >
              Out of Stock
            </Box>
          )}
        </Box>
      )}

      {/* Right Column */}
      <Box
        className={cvStyles.variantInfoParentBox}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
          gap: '0.45rem'
        }}
      >
        {/* Title */}
        <Box className={cvStyles.buttongroup} sx={{ lineHeight: 1.1 }}>
          <Box
            className={cvStyles.variantTitle}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '.9rem',
              fontWeight: 600,
              py: 0.6,
              borderRadius: '0.65rem',
              letterSpacing: '.5px',
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {product?.title}
          </Box>
        </Box>

        {/* Info */}
        {infoText && (
          <Box
            className={cvStyles.variantDescription}
            sx={{
              fontSize: '.8rem',
              lineHeight: 1.25,
              color: '#333',
              fontWeight: 400,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.25rem'
            }}
          >
            {infoLabel ? (
              <>
                <span>{infoLabel}:</span>
                <strong style={{ fontWeight: 600 }}>{infoValue}</strong>
              </>
            ) : (
              infoText
            )}
          </Box>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {/* Add to Cart button anchored at bottom */}
        {outOfStock ? <Typography sx={{ fontSize: 13, my: 1, color: "red", fontFamily: "Jost, sans-serif" }}>Out of stock</Typography> : (
          <Box
            sx={{ mt: 0.25, width: '100%' }}
            onClick={e => e.stopPropagation()}
          >
            <AddToCartButton
              product={product}
              isBlackButton={true}
              enableVariantSelection={false}
              disableRecommendationTrigger={true}
              insertionDetails={insertionDetails}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};
