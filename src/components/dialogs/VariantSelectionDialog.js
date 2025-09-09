"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  Divider,
  Box,
  useMediaQuery,
} from "@mui/material";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useDispatch } from "react-redux";
import { startNavigation } from "@/store/slices/navigationSlice";
import styles from "../page-sections/products-page/styles/changevariantbutton.module.css";

/**
 * Reusable variant selection dialog
 * Can be used by SearchCategoryDialog and other components
 */
export default function VariantSelectionDialog({
  open = false,
  onClose,
  category,
  product,
  onVariantSelect,
  mode = 'search' // 'search' or 'product'
}) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallDevice = useMediaQuery("(max-width: 600px)");
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();

  const isB2B = pathname?.startsWith('/b2b');

  const fetchVariants = useCallback(async () => {
    if (!category) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/features/get-variants?categoryId=${category._id || category.id}`);
      const data = await response.json();
      setVariants(data.variants?.reverse() || []);
    } catch (error) {
      console.error("Error fetching variants:", error);
      setVariants([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  // Fetch variants when dialog opens
  useEffect(() => {
    console.log('VariantSelectionDialog useEffect - open:', open, 'category:', category);
    if (open && category) {
      console.log('Fetching variants for category:', category._id || category.id);
      fetchVariants();
    }
  }, [open, category, fetchVariants]);

  const buildVariantUrl = (variant) => {
    const base = isB2B ? '/b2b' : '/shop';
    
    // In search mode, we want to redirect to product description page
    // Extract the last part of the product's pageSlug and append it to the variant's pageSlug
    if (mode === 'search' && product && product.pageSlug) {
      const productSlugPart = product.pageSlug.split('/').pop(); // Get last part of product slug
      if (productSlugPart && productSlugPart.trim()) {
        console.log('Building URL for search mode:', {
          variant: variant.pageSlug,
          productSlugPart,
          finalUrl: `${base}${variant.pageSlug}/${productSlugPart}`
        });
        return `${base}${variant.pageSlug}/${productSlugPart}`;
      }
    }
    
    // Default behavior for other modes
    console.log('Building URL for default mode:', `${base}${variant.pageSlug}`);
    return `${base}${variant.pageSlug}`;
  };

  const handleVariantClick = (variant) => {
    const targetUrl = buildVariantUrl(variant);
    
    if (onVariantSelect) {
      onVariantSelect(variant, targetUrl);
    } else {
      // Default behavior - navigate
      dispatch(startNavigation());
      router.push(targetUrl);
    }
    
    if (onClose) {
      onClose();
    }
  };

  if (!category) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      sx={{ zIndex: 10000 }}
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
      <DialogContent className={styles.dialogContent} style={{ backgroundColor: '#fff' }}>
        <div
          className={`${styles.jostFam} ${styles.maindialogHeading}`}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
        >
          CHOOSE
        </div>
        <div className={styles.categoryName}>
          {category.name === "Tank Wraps" ? "Tank Size" : category.name}
        </div>
        
        {loading ? (
          <Box display="flex" justifyContent="center" padding="2rem">
            <div>Loading variants...</div>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap="1rem">
            {variants.map((variant, index) => (
              <Box key={variant.id || variant._id}>
                <Box
                  onClick={() => handleVariantClick(variant)}
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
                      {variant.variantInfo && variant.variantInfo.includes(":") ? (
                        <>
                          {variant.variantInfo.split(":")[0]}:
                          <strong
                            style={{ fontWeight: "bold", marginLeft: "0.3rem" }}
                          >
                            {variant.variantInfo.split(":")[1]}
                          </strong>
                        </>
                      ) : (
                        variant.variantInfo || variant.name
                      )}
                    </div>
                  </Box>
                </Box>
                {index !== variants.length - 1 && (
                  <Divider
                    key={`divider-${index}`}
                    style={{ marginTop: "20px", borderColor: "black" }}
                  />
                )}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
