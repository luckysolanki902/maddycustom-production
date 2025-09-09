"use client";

import { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useDispatch } from "react-redux";
import { startNavigation } from "@/store/slices/navigationSlice";

/**
 * Custom hook for handling variant selection logic
 * Determines if a product has single/multiple variants and handles navigation accordingly
 */
export const useVariantHandler = () => {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();

  /**
   * Check if current context is B2B
   */
  const isB2B = pathname?.startsWith('/b2b');

  /**
   * Handle product click with variant checking
   * @param {Object} product - Product object with specificCategory
   * @param {Function} onMultipleVariants - Callback when multiple variants found
   * @param {Function} onSingleVariant - Callback when single variant found (optional)
   * @param {string} redirectPath - Custom redirect path (optional)
   */
  const handleProductClick = useCallback(async (
    product, 
    onMultipleVariants, 
    onSingleVariant = null,
    redirectPath = null
  ) => {
    if (!product.specificCategory) {
      // No specific category, navigate directly to product
      const productSlug = redirectPath || `/shop/${product.pageSlug}`;
      dispatch(startNavigation());
      router.push(productSlug);
      return;
    }

    setLoading(true);

    try {
      // Check variant count for this product's category
      const response = await fetch(`/api/features/get-variants?categoryId=${product.specificCategory}`);
      const data = await response.json();
      
      const variants = data.variants || [];
      
      if (variants.length <= 1) {
        // Single or no variants - navigate directly
        const targetSlug = redirectPath || `/shop/${product.pageSlug}`;
        dispatch(startNavigation());
        router.push(targetSlug);
        
        if (onSingleVariant) {
          onSingleVariant(product, variants[0]);
        }
      } else {
        // Multiple variants - show selection dialog
        onMultipleVariants(product, variants);
      }
    } catch (error) {
      console.error('Error checking variants:', error);
      // Fallback to direct navigation
      const fallbackSlug = redirectPath || `/shop/${product.pageSlug}`;
      dispatch(startNavigation());
      router.push(fallbackSlug);
    } finally {
      setLoading(false);
    }
  }, [router, dispatch, pathname]);

  /**
   * Build URL based on context (B2B vs normal)
   * @param {string} slug - Page slug starting with /
   * @param {string} prefix - Custom prefix (optional)
   */
  const buildUrl = useCallback((slug, prefix = null) => {
    if (prefix) return `${prefix}${slug}`;
    const base = isB2B ? '/b2b' : '/shop';
    return `${base}${slug}`;
  }, [isB2B]);

  return {
    handleProductClick,
    buildUrl,
    loading,
    isB2B
  };
};
