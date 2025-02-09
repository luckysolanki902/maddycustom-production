"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  Box,
  Typography,
  Collapse,
  Button,
  Divider,
  Skeleton,
} from "@mui/material";
import Image from "next/image";
import CustomRenderer from "./CustomRenderer";
import styles from "./styles/product-info-tabs.module.css";
import { useSpring, animated } from "react-spring";

export default function ProductDescription({
  imageUrl,
  productId,
  variantId,
  selectedCategory,
}) {
  // Compute available tabs from selectedCategory.
  const availableTabs = useMemo(() => {
    if (selectedCategory && Array.isArray(selectedCategory.productInfoTabs)) {
      return selectedCategory.productInfoTabs;
    }
    return [];
  }, [selectedCategory]);

  const [tabIndex, setTabIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  /**
   * contentCache will hold the fetched data (or a loading flag) for each tab.
   * The cache key here is the tab title.
   * Example:
   * {
   *   "Description": { loading: false, content: { ... } },
   *   "Specifications": { loading: false, content: null },
   * }
   */
  const [contentCache, setContentCache] = useState({});

  // Create refs for each tab to measure dimensions for the animated underline.
  const tabRefs = useRef([]);

  // Underline spring animation.
  const [underlineStyle, api] = useSpring(() => ({
    left: 0,
    width: 0,
    config: { tension: 300, friction: 30 },
  }));

  // If the available tabs change and the current index is out of range, reset it.
  useEffect(() => {
    if (availableTabs.length > 0 && tabIndex >= availableTabs.length) {
      setTabIndex(0);
    }
  }, [availableTabs, tabIndex]);

  const handleTabClick = (index) => {
    setTabIndex(index);
    setExpanded(false); // Collapse content when changing tab.
  };

  // Clear the cache when key props change (in case product info is different).
  useEffect(() => {
    setContentCache({});
    setExpanded(false);
  }, [productId, variantId, selectedCategory]);

  // Fetch product info content for the current tab if not already cached.
  useEffect(() => {
    if (!selectedCategory || availableTabs.length === 0) return;
    const currentTab = availableTabs[tabIndex];
    if (!currentTab) return;
    const currentTabKey = currentTab.title;

    // If this tab is already loading or fetched (even if null) then do nothing.
    if (
      contentCache[currentTabKey]?.loading ||
      contentCache[currentTabKey]?.content !== undefined
    ) {
      return;
    }

    // Set loading state for the current tab.
    setContentCache((prev) => ({
      ...prev,
      [currentTabKey]: { loading: true, content: null },
    }));

    const tabName = currentTab.title;
    const fetchSource = currentTab.fetchSource; // "Product", "Variant", or "SpecCat"
    let queryParam = "";
    let type = "";

    if (fetchSource === "Product" && productId) {
      queryParam = productId;
      type = "product";
    } else if (fetchSource === "Variant" && variantId) {
      queryParam = variantId;
      type = "variant";
    } else if (fetchSource === "SpecCat" && selectedCategory) {
      queryParam = selectedCategory._id;
      type = "category";
    } else {
      setContentCache((prev) => ({
        ...prev,
        [currentTabKey]: { loading: false, content: null },
      }));
      return;
    }

    fetch(
      `/api/productinfo?type=${type}&id=${queryParam}&tab=${encodeURIComponent(
        tabName
      )}`
    )
      .then((res) => {
        if (res.ok) return res.json();
        else throw new Error("Failed to load product info.");
      })
      .then((data) => {
        if (data && data.content) {
          setContentCache((prev) => ({
            ...prev,
            [currentTabKey]: { loading: false, content: data.content },
          }));
        } else {
          setContentCache((prev) => ({
            ...prev,
            [currentTabKey]: { loading: false, content: null },
          }));
        }
      })
      .catch((error) => {
        console.error("Error loading product info:", error);
        setContentCache((prev) => ({
          ...prev,
          [currentTabKey]: { loading: false, content: null },
        }));
      });
  }, [tabIndex, productId, variantId, selectedCategory, availableTabs, contentCache]);

  // Update the animated underline dimensions when the active tab changes.
  useLayoutEffect(() => {
    if (tabRefs.current[tabIndex]) {
      const { offsetLeft, clientWidth } = tabRefs.current[tabIndex];
      api.start({ left: offsetLeft, width: clientWidth });
    }
  }, [tabIndex, availableTabs, api]);

  // Determine the current tab's cached data.
  const currentTabKey = availableTabs[tabIndex]?.title;
  const tabData = currentTabKey ? contentCache[currentTabKey] : null;
  const isLoading = tabData ? tabData.loading : false;
  const fetchedContent = tabData ? tabData.content : null;
  const hasFetchedContent =
    fetchedContent && fetchedContent.blocks && fetchedContent.blocks.length > 0;

  return (
    <Box className={styles.mainCont}>
      <Box
        sx={{
          maxWidth: "100%",
          mx: "auto",
          p: { xs: 1, sm: 3 },
          // bgcolor: "rgba(217, 217, 217, 0.6)",
          bgcolor: "rgba(255, 255, 255, 1)",
          borderRadius: 2,
          position: "relative",
          fontFamily: "Jost",
        }}
      >
        {/* Tabs Header */}
        <Box
          className={styles.tabsContainer}
          sx={{
            position: "relative",
            overflowX: "auto",
            whiteSpace: "nowrap",
            mb: { xs: 2, sm: 3 },
          }}
        >
          {availableTabs.map((tab, index) => (
            <Box
              key={tab.title}
              ref={(el) => (tabRefs.current[index] = el)}
              className={styles.tabItem}
              onClick={() => handleTabClick(index)}
            >
              <Typography
                sx={{
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontFamily: "Jost",
                  fontSize: { xs: "1rem", sm: "1.2rem" },
                  px: 2,
                  py: 1,
                }}
              >
                {tab.title}
              </Typography>
            </Box>
          ))}
          {/* Animated Underline */}
          <animated.div className={styles.underline} style={underlineStyle} />
        </Box>

        <Divider />

        {/* Main Product Image for "Description" tab */}
        {availableTabs[tabIndex]?.title?.toLowerCase() === "description" &&
          imageUrl && (
            <Box sx={{ my: { xs: 2, sm: 3 }, textAlign: "center" }}>
              <Box
                sx={{
                  position: "relative",
                  width: { xs: "90%", sm: "90%" },
                  height: expanded ? "auto" : { xs: "200px", sm: "350px" },
                  borderRadius: "8px",
                  overflow: "hidden",
                  mx: "auto",
                }}
              >
                <Image
                  src={imageUrl}
                  alt="Product Image"
                  width={1000}
                  height={1000}
                  style={{ objectFit: "cover", width: "100%", height: "auto" }}
                  className={styles.commonProductImage}
                />
              </Box>
            </Box>
          )}

        {/* Fetched Additional Content */}
        <Box sx={{ mt: 2 }}>
          {isLoading ? (
            // Show skeleton until data is loaded.
            <Box sx={{ textAlign: "center" }}>Loading...</Box>
          ) : hasFetchedContent ? (
            <>
              <Collapse in={expanded} timeout="auto" unmountOnExit>
                <Box sx={{ p: { xs: 1, sm: 2 } }}>
                  <CustomRenderer data={fetchedContent} />
                </Box>
              </Collapse>
              <Box sx={{ textAlign: "center", mt: 1 }}>
                <Button
                  onClick={() => setExpanded(!expanded)}
                  sx={{
                    color: "#000",
                    fontWeight: "bold",
                    textTransform: "none",
                    fontFamily: "Jost",
                    fontSize: { xs: "0.9rem", sm: "1rem" },
                  }}
                >
                  {expanded ? "Read less" : "Read more"} ▼
                </Button>
              </Box>
            </>
          ) : (
            // Only display the "no details" message after loading is finished.
            !isLoading && (
              <Typography
                sx={{
                  color: "#333",
                  fontSize: { xs: "0.9rem", sm: "1rem" },
                  textAlign: "center",
                  mt: 2,
                }}
              >
                No additional details available for this product.
              </Typography>
            )
          )}
        </Box>
      </Box>
    </Box>
  );
}
