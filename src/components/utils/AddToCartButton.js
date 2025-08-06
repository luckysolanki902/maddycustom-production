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

export default function AddToCartButton({
  product,
  isBlackButton = false,
  isLarge = false,
  smaller = false,
  insertionDetails = {},
}) {
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart.items);
  const cartItem = cartItems.find(item => item.productId === product._id);

  // State to track last action for animation
  const [lastAction, setLastAction] = useState(null); // 'increment' or 'decrement'

  // State for similar products toast
  const [showSimilarToast, setShowSimilarToast] = useState(false);
  const [toastProduct, setToastProduct] = useState(null);

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

  // --- INVENTORY / STOCK MANAGEMENT ---
  // Determine the inventory data source: product inventoryData takes precedence, else selectedOption inventoryData.
  const inventoryData = product.inventoryData || (product.selectedOption && product.selectedOption?.inventoryData) || null;
  let maxAllowed = Infinity;
  let isLimited = false;
  if (inventoryData) {
    const { availableQuantity, reorderLevel } = inventoryData;
    maxAllowed = Math.floor(availableQuantity / 2);
    isLimited = true;
    // If available quantity is less than the reorder level, we limit the addition.
    if (availableQuantity < reorderLevel) {
      isLimited = true;
      maxAllowed = Math.min(availableQuantity, Math.floor(0.1 * reorderLevel));
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

  const handleAdd = async e => {
    e.stopPropagation(); // Prevent parent onClick
    // Check: if limited and adding one would exceed maxAllowed, do nothing.
    if (isLimited && currentQuantity + 1 > maxAllowed) return;

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
    if (wasCartEmpty && product.designGroupId) {
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
    if (isLimited && currentQuantity >= maxAllowed) return;

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

  if (cartItem) {
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
          title={isLimited && currentQuantity >= maxAllowed ? "" : ""}
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

  return (
    <>
      <button
        onClick={handleAdd}
        className={addToCartClasses}
        style={{ outline: "none", border: "none" }}
        disabled={isLimited && currentQuantity + 1 > maxAllowed}
      >
        <span>Add to cart</span>
      </button>

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
