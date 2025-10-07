"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  Divider,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  useMediaQuery,
} from "@mui/material";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import styles from "./styles/changevariantbutton.module.css";
import { useDispatch, useSelector } from "react-redux";
import {
  setHasSeenVariantPopup,
  setPageSlug,
  setPreferredVariant,
} from "@/store/slices/variantPreferenceSlice";
import { startNavigation, completeNavigation } from '@/store/slices/navigationSlice';

/**
 * Flexible variant selector usable in normal shop and B2B context.
 * Props:
 *  - category (required)
 *  - mode: 'default' | 'b2b' (optional). If omitted, inferred from current pathname (/b2b prefix)
 *  - buildUrl: optional custom (slug, ctx) => fullPath function (slug = variant.pageSlug starting with '/')
 *  - b2bPrefix: prefix for B2B routes (default '/b2b')
 *  - shopPrefix: prefix for normal routes (default '/shop')
 *  - product: optional product object for external variant checking
 *  - onExternalVariantCheck: optional callback for external variant handling
 *  - hideIfSingleVariant: if true, hide button when only one variant (default: false)
 *  - disableAutoPopup: if true, disable automatic popup on load (default: false)
 */
export default function ChangeVariantButton({ 
  category, 
  mode, 
  buildUrl, 
  b2bPrefix = '/b2b', 
  shopPrefix = '/shop',
  product = null,
  onExternalVariantCheck = null,
  hideIfSingleVariant = false,
  disableAutoPopup = false
}) {
  const [showPopup, setShowPopup] = useState(false);
  const [variants, setVariants] = useState([]);
  const [useMapping, setUseMapping] = useState(false);
  const [letterMappingGroups, setLetterMappingGroups] = useState([]);
  const [mappingSelections, setMappingSelections] = useState({});
  const [variantCheckLoading, setVariantCheckLoading] = useState(false);

  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallDevice = useMediaQuery("(max-width: 600px)");
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();

  const categoryPreferences = useSelector(
    (state) => state.variantPreference[category._id]
  );
  const hasSeenVariantPopup = categoryPreferences?.hasSeenVariantPopup || false;
  const savedPageSlug = categoryPreferences?.pageSlug;

  // Fast auto-redirect if we have a saved preference for this category that differs from current path
  useEffect(() => {
    if (!category || !savedPageSlug) return;
    // If current pathname already matches saved slug, do nothing
    if (pathname === savedPageSlug) return;
    // Avoid loops: ensure slug starts with /shop
    if (!savedPageSlug.startsWith('/shop')) return;
    // --- NEW: Skip auto-redirect when we're on a PRODUCT DETAIL page (deeper path) ---
    // Depth-based skip for product pages (logs removed)
    try {
      const currentParts = pathname.split('/').filter(Boolean);
      const savedParts = savedPageSlug.split('/').filter(Boolean);
      const isDeeperThanSaved = currentParts.length > savedParts.length;
      if (isDeeperThanSaved) return; // Skip redirect on product detail page
    } catch {}
    // (Auto redirect log removed)
    // Trigger full page loader & redirect ASAP
    dispatch(startNavigation({ url: savedPageSlug }));
    router.replace(savedPageSlug);
    // We'll optimistically complete after a short delay if app router doesn't
    const t = setTimeout(() => dispatch(completeNavigation()), 4000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPageSlug]);

  useEffect(() => {
    // Check if this category uses letter-mapping
    if (category.useLetterMapping) {
      setUseMapping(true);
      setLetterMappingGroups(category.letterMappingGroups || []);
    }

    // Fetch normal variants if not using letter-mapping
    const fetchVariants = async () => {
      try {
        const response = await fetch(
          `/api/features/get-variants?categoryId=${category._id}`
        );
        const data = await response.json();
        setVariants(data.variants?.reverse() || []);
      } catch (error) {
        console.error("Error fetching variants:", error);
      }
    };
    fetchVariants();
  }, [category]);

  // Auto-popup if more than 2 variants and user hasn't seen it, only if NOT using letter mapping and auto-popup is not disabled
  useEffect(() => {
    if (!disableAutoPopup && variants.length > 2 && !hasSeenVariantPopup) {
      const timer = setTimeout(() => {
        setShowPopup(true);
        dispatch(
          setHasSeenVariantPopup({ categoryId: category._id, hasSeen: true })
        );
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [variants, hasSeenVariantPopup, dispatch, category._id, useMapping, disableAutoPopup]);

  /**
   * Determine context (B2B vs normal) & helpers
   */
  const isB2B = useMemo(() => {
    if (mode === 'b2b') return true;
    if (mode === 'default') return false;
    return pathname?.startsWith('/b2b');
  }, [mode, pathname]);

  const buildTarget = useCallback((slug) => {
    if (buildUrl) return buildUrl(slug, { isB2B, category });
    const base = isB2B ? b2bPrefix : shopPrefix; // both start with '/'
    return `${base}${slug}`; // slug already begins with '/'
  }, [buildUrl, isB2B, category, b2bPrefix, shopPrefix]);

  const handleVariantClick = (slug) => {
    const target = buildTarget(slug);
    const variantObj = variants.find(v => v.pageSlug === slug);
    // (Variant click log removed)
    if (variantObj) {
      dispatch(setPreferredVariant({ 
        categoryId: category._id, 
        variantId: variantObj.id, 
        variantCode: variantObj.variantCode 
      }));
    }
    dispatch(setPageSlug({ categoryId: category._id, pageSlug: target }));
    dispatch(startNavigation({ url: target }));
    router.push(target);
    setShowPopup(false);
  };

  /**
   * Handle letter-mapping changes
   */
  const handleMappingChange = (groupName, letterCode) => {
    setMappingSelections((prev) => ({
      ...prev,
      [groupName]: letterCode,
    }));
  };

  /**
   * Build final variant code, find the matching variant, and navigate for letter-mapping
   */
  const handleMappingSubmit = () => {
    let finalCode = category.specificCategoryCode || "";
    for (const group of letterMappingGroups) {
      const chosenLetter = mappingSelections[group.groupName];
      if (!chosenLetter) {
        alert(`Please choose an option for ${group.groupName}`);
        return;
      }
      finalCode += chosenLetter;
    }

    // Find the variant with the corresponding variant code (finalCode)
    const matchedVariant = variants.find(
      (variant) => variant.variantCode?.toLowerCase() === finalCode.toLowerCase()
    );

    if (!matchedVariant) {
      alert("Variant not found for the selected options.");
      return;
    }

    // Construct the final route using the matched variant's pageSlug
  const finalSlug = buildTarget(matchedVariant.pageSlug);
  // Persist preference (id + code + slug)
  dispatch(setPreferredVariant({ 
    categoryId: category._id, 
    variantId: matchedVariant.id, 
    variantCode: matchedVariant.variantCode 
  }));
  dispatch(setPageSlug({ categoryId: category._id, pageSlug: finalSlug }));
  dispatch(startNavigation({ url: finalSlug }));
  router.push(finalSlug);
    setShowPopup(false);
  };

  /**
   * Handle button click - either show popup directly or check variants first
   */
  const handleButtonClick = async () => {
    // If we have an external variant check callback and product, use it
    if (onExternalVariantCheck && product) {
      setVariantCheckLoading(true);
      try {
        await onExternalVariantCheck(product, variants);
      } catch (error) {
        console.error('External variant check failed:', error);
        setShowPopup(true);
      } finally {
        setVariantCheckLoading(false);
      }
    } else {
      // Default behavior - show popup directly
      setShowPopup(true);
    }
  };

  /**
   * Dialog for normal variants
   */
  const renderVariantsDialog = () => (
    <Dialog
      open={showPopup}
      fullWidth
      onClose={() => setShowPopup(false)}
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
      <DialogContent className={styles.dialogContent} style={{backgroundColor:'#fff'}}>
        <div
          className={`${styles.jostFam} ${styles.maindialogHeading}`}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
        >
          CHOOSE
        </div>
        <div className={styles.categoryName}>
          {category.name === "Tank Wraps" ? "Tank Size" : category.name}
        </div>
        <Box display="flex" flexDirection="column" gap="1rem">
          {variants.map((variant, index) => (
            <Box key={variant.id}>
              <Box
                onClick={() => handleVariantClick(variant.pageSlug)}
                className={styles.variantBox}
                sx={{
                  cursor: "pointer",
                  borderRadius: "0.5rem",
                  padding: "1rem 1rem",
                  backgroundColor: "#fff!important",
                  boxShadow: "0px 2px 6px rgba(0,0,0,0.1)",
                  "&:hover": {
                    boxShadow: "0px 4px 10px rgba(0,0,0,0.2)",
                  },
                }}
              >
                {variant.image && (
                  <Image
                    src={
                      variant.image.startsWith("/")
                        ? baseImageUrl + variant.image
                        : baseImageUrl + "/" + variant.image
                    }
                    className={styles.customImg}
                    alt={variant.name}
                    width={360 * 1.5}
                    height={150 * 1.5}
                  />
                )}
                <Box className={styles.variantInfoParentBox}>
                  <div className={styles.buttongroup}>
                    <button className={styles.variantButton}>
                      {variant?.name?.toLowerCase().includes("tank")
                        ? variant.name.split(" ")[0]
                        : variant.name}
                    </button>
                  </div>
                  <div className={styles.variantDescription}>
                    {variant.variantInfo.split(":")[0]}:
                    <strong
                      style={{ fontWeight: "bold", marginLeft: "0.3rem" }}
                    >
                      {variant.variantInfo.split(":")[1]}
                    </strong>
                  </div>
                </Box>
              </Box>
              {index !== variants.length - 1 && (
                <Divider
                  key={index}
                  style={{ marginTop: "20px", borderColor: "black" }}
                />
              )}
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );

  /**
   * Dialog for letter-mapping
   */
  const renderLetterMappingDialog = () => (
    <Dialog
      open={showPopup}
      fullWidth
      onClose={() => setShowPopup(false)}
      PaperProps={{
        sx: {
          borderRadius: "20px",
          maxWidth: "500px",
          width: "100%",
          overflow: "hidden",
          boxShadow: "0px 8px 16px rgba(0, 0, 0, 0.2)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "85vh",
        },
      }}
    >
      <DialogContent sx={{ 
        flex: 1,
        overflowY: "auto", 
        padding: "1rem",
        paddingBottom: "0.5rem"
      }}>
        <Box
          sx={{
            fontSize: "1.5rem",
            textAlign: "center",
            fontWeight: "bold",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          CHOOSE
          {category.name.trim() === "Fuel Cap Wraps" && (
            <Image
              src={`${baseImageUrl}/assets/icons/mandatory (1).jpeg`}
              alt="Mandatory Icon"
              width={120}
              height={120}
              loading="eager"
              style={{
                objectFit: "contain",
                maxHeight: "120px",
                verticalAlign: "middle",
              }}
            />
          )}
        </Box>


        {letterMappingGroups.map((group) => (
          <Box key={group.groupName} sx={{ marginBottom: "2rem" }}>
            <div style={{ fontWeight: "500", textAlign: "center" }}>
              {group.groupName}
            </div>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "0.5rem",
                justifyItems: "center",
                "@media (max-width: 500px)": {
                  gridTemplateColumns: "repeat(2, 1fr)",
                },
              }}
            >
              {group.mappings.map((option) => (
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
                  onClick={() =>
                    handleMappingChange(group.groupName, option.letterCode)
                  }
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
                        checked={
                          mappingSelections[group.groupName] ===
                          option.letterCode
                        }
                        onChange={() =>
                          handleMappingChange(group.groupName, option.letterCode)
                        }
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
      </DialogContent>

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
        </Button>
      </Box>
    </Dialog>
  );

  return (
  // Hide button conditions:
  // 1. No letter-mapping AND fewer than 2 variants (default behavior)
  // 2. hideIfSingleVariant is true AND only 1 variant
  (!useMapping && variants.length < 2) || (hideIfSingleVariant && variants.length <= 1) ? null : (
    <>
      {/* The Button that triggers the dialog */}
      <div 
        className={styles.bikeStyle} 
        onClick={handleButtonClick}
        style={{ 
          opacity: variantCheckLoading ? 0.6 : 1,
          pointerEvents: variantCheckLoading ? 'none' : 'auto'
        }}
      >
        {variantCheckLoading ? 'Loading...' : (
          useMapping
            ? (isB2B ? 'Customize Variant' : 'Customize Variant')
            : category.name === "Tank Wraps"
            ? (isB2B ? 'Change Tank Size' : 'Change Tank Size')
            : (isB2B ? 'Change Variant' : 'Change Variant')
        )}
      </div>

      {/* Render the appropriate dialog */}
      {!useMapping && renderVariantsDialog()}
      {useMapping && renderLetterMappingDialog()}
    </>
    )
  );
}
