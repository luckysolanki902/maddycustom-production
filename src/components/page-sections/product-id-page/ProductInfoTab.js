"use client";

import { useState, useLayoutEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import CustomRenderer from "./CustomRenderer";
import styles from "./styles/product-info-tabs.module.css";

export default function ProductDescription({
  productInfoTabs = [],
  imageUrl = "",
  showProductImageFirst = false,
}) {
  // Track which tab is active
  const [tabIndex, setTabIndex] = useState(0);

  // Track whether the content is collapsed or expanded
  const [expanded, setExpanded] = useState(false);

  // Refs used to measure tab widths and positions for the underline animation
  const tabRefs = useRef([]);

  // Track underline metrics
  const [underline, setUnderline] = useState({ left: 0, width: 0 });

  const availableTabs = productInfoTabs; // A simple alias

  // Move the underline whenever tabIndex changes
  useLayoutEffect(() => {
    if (!availableTabs[tabIndex]) return;
    const el = tabRefs.current[tabIndex];
    if (!el) return;
    setUnderline({ left: el.offsetLeft, width: el.clientWidth });
  }, [tabIndex, availableTabs]);

  // Handle tab click
  const handleTabClick = (index) => {
    setTabIndex(index);
    setExpanded(false); // Reset expanded state when switching tabs
  };

  // The currently selected tab’s data
  const currentTab = availableTabs[tabIndex];
  if (!currentTab) {
    return null; // If no tabs or index out of range
  }

  // For optional: first block in Editor JS might be an image
  const blocks = currentTab.content?.blocks || [];
  let firstImageBlock = null;
  let remainingContent = currentTab.content;

  // Separate "Product Details" content
  const productDetailsHeadingIndex = blocks.findIndex(block => block.type === "paragraph" && block.data.text.includes("Product Details"));
  let productDetailsContent = [];
  let contentAfterProductDetails = [];

  if (productDetailsHeadingIndex !== -1) {
    productDetailsContent = blocks.slice(0, productDetailsHeadingIndex + 1); // Includes "Product Details"
    contentAfterProductDetails = blocks.slice(productDetailsHeadingIndex + 1);
  } else {
    contentAfterProductDetails = blocks;
  }

  // If we do NOT want to showProductImageFirst, 
  // we can check if the first block is an image. Then separate it:
  if (!showProductImageFirst && blocks[0]?.type === "image") {
    firstImageBlock = blocks[0];
    remainingContent = {
      ...currentTab.content,
      blocks: blocks.slice(1),
    };
  }

  return (
    <div className={styles.mainCont}>
      <div className={`${styles.tabsContainer} ${styles.stickyTabs}`}>
        {availableTabs.map((tab, index) => (
          <div
            key={tab.title}
            ref={el => (tabRefs.current[index] = el)}
            className={`${styles.tabItem} ${index === tabIndex ? styles.tabItemActive : ""}`}
            onClick={() => handleTabClick(index)}
          >
            {tab.title}
          </div>
        ))}
        <motion.div
          className={styles.underline}
          animate={{ left: underline.left, width: underline.width }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
        />
      </div>

      <div className={`${styles.contentShell} ${styles.fadeIn}`}>
        {showProductImageFirst && currentTab.title.toLowerCase() === "description" && imageUrl && (
          <div className={styles.leadingImageWrap}>
            <Image src={imageUrl} alt="Product Image" width={1200} height={1200} className={styles.leadingImage} />
          </div>
        )}
        {firstImageBlock && !showProductImageFirst && (
            <div className={styles.leadingImageWrap}>
              <Image
                src={firstImageBlock.data.file.url}
                alt={firstImageBlock.data.caption || "Content image"}
                width={1200}
                height={1200}
                className={styles.leadingImage}
              />
            </div>
        )}

        {/* Always visible Product Details part */}
        <CustomRenderer data={{ blocks: productDetailsContent }} />

        {/* Preview & full content handling */}
        {(() => {
          const PREVIEW_LIMIT = 3; // number of blocks after Product Details to always show
          const hasExtra = contentAfterProductDetails.length > PREVIEW_LIMIT;
          const previewBlocks = hasExtra ? contentAfterProductDetails.slice(0, PREVIEW_LIMIT) : contentAfterProductDetails;
          const remainingBlocks = hasExtra ? contentAfterProductDetails.slice(PREVIEW_LIMIT) : [];

          return (
            <div className={styles.afterDetailsWrapper}>
              {!expanded && (
                <>
                  <CustomRenderer data={{ blocks: previewBlocks }} />
                  {hasExtra && <div className={styles.previewGradient} />}
                </>
              )}
              <AnimatePresence initial={false}>
                {expanded && hasExtra && (
                  <motion.div
                    key="rest"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {/* Render full set (we already rendered productDetails separately) */}
                    <CustomRenderer data={{ blocks: contentAfterProductDetails }} />
                  </motion.div>
                )}
              </AnimatePresence>
              {hasExtra && (
                <button
                  type="button"
                  data-clarity="read-more-prod-desc"
                  aria-expanded={expanded}
                  className={styles.readMoreBtn}
                  onClick={() => setExpanded(e => !e)}
                >
                  <span>{expanded ? "Read less" : "Read more"}</span>
                  <motion.span
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    style={{ display: "inline-block" }}
                  >
                    ▼
                  </motion.span>
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
