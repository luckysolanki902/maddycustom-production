"use client";

import { useState, useLayoutEffect, useRef } from "react";
import {
  Box,
  Typography,
  Collapse,
  Button,
  Divider,
} from "@mui/material";
import Image from "next/image";
import { useSpring, animated } from "react-spring";

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

  // Underline spring animation
  const [underlineStyle, api] = useSpring(() => ({
    left: 0,
    width: 0,
    config: { tension: 300, friction: 30 },
  }));

  const availableTabs = productInfoTabs; // A simple alias

  // Move the underline whenever tabIndex changes
  useLayoutEffect(() => {
    if (!availableTabs[tabIndex]) return;
    const refEl = tabRefs.current[tabIndex];
    if (!refEl) return;

    const { offsetLeft, clientWidth } = refEl;
    api.start({ left: offsetLeft, width: clientWidth });
  }, [tabIndex, availableTabs, api]);

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
    <Box className={styles.mainCont}>
      <Box
        sx={{
          maxWidth: "100%",
          mx: "auto",
          p: { xs: 1, sm: 3 },
          bgcolor: "rgba(255, 255, 255, 1)",
          borderRadius: 2,
          position: "relative",
          fontFamily: "Jost",
        }}
      >
        {/* ----------- TABS HEADER ----------- */}
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

          {/* ANIMATED UNDERLINE */}
          <animated.div className={styles.underline} style={underlineStyle} />
        </Box>

        <Divider />

        {/* ----------- CASE 1: Show leading product image if requested ----------- */}
        {showProductImageFirst &&
          currentTab.title.toLowerCase() === "description" &&
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

        {/* ----------- CASE 2: Render the tab content ----------- */}
        <Box sx={{ mt: 2 }}>
          {/* If the first block is an image (when !showProductImageFirst): */}
          {firstImageBlock && (
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
                  src={firstImageBlock.data.file.url}
                  alt={firstImageBlock.data.caption || "Content image"}
                  width={1000}
                  height={1000}
                  style={{
                    objectFit: "cover",
                    width: "100%",
                    height: "auto",
                  }}
                />
              </Box>
            </Box>
          )}

          {/* The rest of the EditorJS content, in a collapsible container */}
          <Collapse
            in={expanded}
            collapsedSize={showProductImageFirst ? "0px" : "150px"} 
            timeout="auto"
            sx={{ overflow: "hidden" }}
          >
            <Box sx={{ p: { xs: 1, sm: 2 } }}>
              <CustomRenderer data={remainingContent} />
            </Box>
          </Collapse>

          {/* READ MORE / LESS BUTTON */}
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
        </Box>
      </Box>
    </Box>
  );
}
