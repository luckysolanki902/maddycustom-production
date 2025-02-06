'use client';

import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Collapse, Button, Divider } from '@mui/material';
import Image from 'next/image';
import CustomRenderer from './CustomRenderer';

export default function ProductDescription({ imageUrl, productId, variantId, selectedCategory }) {
  if (!selectedCategory?.productInfoTabs || selectedCategory.productInfoTabs.length === 0) {
    return null;
  }
  // Derive available tabs from the category's productInfoTabs.
  const availableTabs = useMemo(() => {
    if (selectedCategory && Array.isArray(selectedCategory.productInfoTabs)) {
      return selectedCategory.productInfoTabs;
    }
    return [];
  }, [selectedCategory]);

  // Default to the first available tab or 0.
  const [tabIndex, setTabIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [fetchedContent, setFetchedContent] = useState(null);

  // Reset the selected tab index when available tabs change.
  useEffect(() => {
    if (availableTabs.length > 0 && tabIndex >= availableTabs.length) {
      setTabIndex(0);
    }
  }, [availableTabs, tabIndex]);

  const handleTabClick = (index) => {
    setTabIndex(index);
    setExpanded(false); // Optionally collapse when changing tabs
  };

  const fetchProductInfoContent = async () => {
    if (!selectedCategory || availableTabs.length === 0) return;

    // Use the current tab's title.
    const currentTab = availableTabs[tabIndex];
    const tabName = currentTab.title;
    const fetchSource = currentTab.fetchSource; // e.g., "Product", "Variant", or "SpecCat"

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
      // If required IDs are missing, do not fetch.
      setFetchedContent(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/productinfo?type=${type}&id=${queryParam}&tab=${encodeURIComponent(tabName)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.content) {
          setFetchedContent(data.content);
        } else {
          setFetchedContent(null);
        }
      } else {
        console.error("Failed to load product info.");
        setFetchedContent(null);
      }
    } catch (error) {
      console.error("Error loading product info:", error);
      setFetchedContent(null);
    }
  };

  useEffect(() => {
    fetchProductInfoContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIndex, productId, variantId, selectedCategory]);

  return (
    <Box
      sx={{
        maxWidth: { xs: '100%', sm: 700 },
        mx: 'auto',
        p: { xs: 1, sm: 3 },
        bgcolor: 'rgba(217, 217, 217, 0.6)',
        borderRadius: 2,
        position: 'relative',
        fontFamily: 'Jost',
        // height: expanded?'auto':'600px',
        // overflow:'hidden'
      }}
    >
      {/* Render the tabs header only if there are available tabs */}
      {availableTabs.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'flex-start',
            alignItems: { xs: 'flex-start', sm: 'center' },
            mb: { xs: 3, sm: 5 },
            ml: { xs: 2, sm: 4 },
            fontFamily: 'Jost',
            gap: { xs: 1, sm: 0 },
          }}
        >
          {availableTabs.map((tab, index) => (
            <Box key={tab.title} sx={{ display: 'flex', alignItems: 'center'}}>
              <Typography
                onClick={() => handleTabClick(index)}
                sx={{
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderBottom: tabIndex === index ? '3px solid black' : 'none',
                  fontFamily: 'Jost',
                  fontSize: { xs: '1rem', sm: '1.2rem' },
                }}
              >
                {tab.title}
              </Typography>
              {index !== availableTabs.length - 1 && (
                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                    height: 20,
                    mx: 2,
                    bgcolor: 'black',
                  }}
                />
              )}
            </Box>
          ))}
        </Box>
      )}

      {availableTabs[tabIndex]?.title?.toLowerCase()==='description' && <Box sx={{ mx: { xs: 2, sm: 2 }, mb: { xs: 3, sm: 4 } }}>
        {/* Wrap Image in a responsive Box */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: 260, sm: 600 },
            height: { xs: 200, sm: 350 },
            borderRadius: '8px',
            overflow: 'hidden',
            mx: 'auto',
          }}
        >
          <Image
            src={imageUrl}
            alt="Product Image"
            fill
            sizes="(max-width: 600px) 300px, 600px"
            style={{ objectFit: 'cover' }}
          />
        </Box>
      </Box>}

      <Collapse in={expanded}>
        <Box sx={{ p: { xs: 1, sm: 2 } }}>
          {fetchedContent ? (
            <CustomRenderer data={fetchedContent} />
          ) : (
            <Typography sx={{ color: '#333', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              {/* Use the current tab title in the fallback message */}
              {`No ${availableTabs[tabIndex]?.title?.toLowerCase() || 'content'} available for this product.`}
            </Typography>
          )}
        </Box>
      </Collapse>

      <Button
        onClick={() => setExpanded(!expanded)}
        sx={{
          mt: 2,
          color: '#000',
          fontWeight: 'bold',
          textTransform: 'none',
          fontFamily: 'Jost',
          fontSize: { xs: '0.9rem', sm: '1rem' },
        }}
      >
        Read {expanded ? 'less' : 'more'} ▼
      </Button>
    </Box>
  );
}

