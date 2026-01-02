"use client";

import React, { useState, useEffect, useRef, memo, useMemo, useCallback } from "react";
import Image from "next/image";
import styles from "./styles/productid.module.css";
import { useSelector, useDispatch } from "react-redux";
import { removeItem, setWrapFinish } from "@/store/slices/cartSlice";
import OrderSpecifications from "../page-sections/product-id-page/OrderSpecifications";
import PriceAndChat from "../page-sections/product-id-page/PriceAndChat";
import HappyCustomersClient from "../showcase/sliders/HappyCustomerClient";
import { viewContent } from "@/lib/metadata/facebookPixels";
import funnelClient from "@/lib/analytics/funnelClient";
import ContactUs from "../layouts/ContactUs";
import AddToCartButtonWithOrder from "../utils/AddToCartButtonWithOrder";
import ImageGallery from "../page-sections/product-id-page/ImageGallery";
import ReviewFullComp from "../page-sections/product-id-page/ReviewFullComp";
import ProductDescription from "../page-sections/product-id-page/ProductInfoTab";
import { TopBoughtProducts } from "../showcase/products/TopBoughtProducts";
import Footer from "../layouts/Footer";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import useMediaQuery from "@mui/material/useMediaQuery";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Box, Typography } from "@mui/material";
import WrapFinishSelector from "../page-sections/product-id-page/WrapFinishSelector";
import OptionSelector from "../page-sections/product-id-page/OptionSelector";
import SimilarProducts from "../page-sections/product-id-page/SimilarProducts";
import AddToCartButton from "../utils/AddToCartButton";
import ChangeVariantButton from "../page-sections/products-page/ChangeVariantButton";
import VariantSelectionDialog from "../dialogs/VariantSelectionDialog";
import { setAssistantContext } from '@/store/slices/assistantContextSlice';

// Memoize components that do not need to update on option change
const MemoizedImageGallery = memo(ImageGallery);
const MemoizedOrderSpecifications = memo(OrderSpecifications);
const MemoizedPriceAndChat = memo(PriceAndChat);
const MemoizedProductDescription = memo(ProductDescription);
const MemoizedTopBoughtProducts = memo(TopBoughtProducts);
const MemoizedReviewFullComp = memo(ReviewFullComp);
const MemoizedAddToCartButtonWithOrder = memo(AddToCartButtonWithOrder);

export default function ProductIdPage({
  product: initialProduct,
  variant,
  category,
  description,
  productInfoTabs = [],
  // Options are expected to come with image data, optionDetails, inventoryData, and optionally thumbnail
}) {
  // Use the product prop directly since we're using page refresh approach
  const product = initialProduct;
  const utmDetails = useSelector(state => state.utm?.utmDetails);
  // -- Color map for color options --
  const colorMap = {
    red: "#ff0066",
    blue: "#66ccff",
    green: "#99ff99",
    yellow: "#fff68f",
    orange: "#ffb347",
    pink: "#ff99cc",
    purple: "#cdb3e6",
    black: "#555555",
    white: "#ffffff",
    gray: "#cccccc",
    chrome: "#d9d9d9",
    candyred: "#b44b08",
  };

  // pull MRP & final price, then memoize discount%
  // 1) fallback to 1000 if MRP is missing
  const mrp = product.MRP ?? 1000;
  const finalPrice =
    product.variantDetails?.availableBrands?.length > 0
      ? product.variantDetails.availableBrands[0].brandBasePrice + product.price
      : product.price;
  const discountPercent = useMemo(() => Math.round(((mrp - finalPrice) / mrp) * 100), [mrp, finalPrice]);

  const options = useMemo(() => product.options || [], [product.options]);
  const [isZoomed, setIsZoomed] = useState(false);
  const [soldCount, setSoldCount] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  // New state for mobile: toggle showing more options dropdown
  const [showMoreColors, setShowMoreColors] = useState(false);
  const userDetails = useSelector(state => state.orderForm.userDetails);
  const { email, phoneNumber } = userDetails || {};
  const hasTracked = useRef(false);
  const hasTrackedVisit = useRef(false);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const pathname = usePathname();
  const router = useRouter();
  const [isDisabled, setIsDisabled] = useState(false);
  // now remove the last slug that's product id, to get link to products list page
  const productListPageLink = pathname.split("/").slice(0, -1).join("/");
  // Memoize the product list page link to avoid unnecessary re-renders
  const memoizedProductListPageLink = useMemo(() => productListPageLink, [productListPageLink]);
  const [selectedWrapFinish, setSelectedWrapFinish] = useState("Matte");
  const [showVariantDialog, setShowVariantDialog] = useState(false);
  const [variantCheckLoading, setVariantCheckLoading] = useState(false);

  useEffect(() => {
    hasTrackedVisit.current = false;
  }, [product?._id, pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasTrackedVisit.current) return;

    const pagePath = window.location.pathname || pathname;
    const page = {
      path: pagePath,
      name: 'product-id-page',
      pageCategory: 'product-id-page',
      category: category?.name || product?.category?.name || product?.category,
      slug: pagePath.replace(/^\//, ''),
      title: product?.title || product?.name,
    };

    const metadata = {
      pageType: 'product-id-page',
      pageCategory: 'product-id-page',
      productId: product?._id,
      categoryId: category?._id,
      variantId: variant?._id,
    };

    funnelClient.setPageContext({
      page,
      metadata,
      product: {
        id: product?._id,
        name: product?.name || product?.title,
        price: product?.price,
        category: category?.name || product?.category,
      },
    });

    hasTrackedVisit.current = true;
  }, [category?._id, category?.name, pathname, product?._id, product?.name, product?.price, product?.title, product?.category, variant?._id, utmDetails]);

  const insertionDetails = {
    component: "productDetails-AddToCart",
    pageType: "product-id-page",
  };

  // Cloudfront URL for the icon (used when thumbnail is not provided)
  const moreImagesIconUrl = `${imageBaseUrl}/assets/icons/more-images-icon.jpg`;

  // Get dispatch and cart items from redux
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart.items);
  const cartItem = cartItems.find(item => item.productId === product._id);
  // Compute the option label from the first valid option’s key (pluralized)
  let optionLabel = "Options";
  if (options && options.length > 0) {
    const validOption = options.find(
      opt =>
        opt.optionDetails &&
        Object.keys(opt.optionDetails).length > 0 &&
        opt.inventoryData &&
        opt.inventoryData.availableQuantity > 0
    );
    if (validOption) {
      const firstKey = Object.keys(validOption.optionDetails)[0];
      optionLabel = "Select " + firstKey.charAt(0).toUpperCase() + firstKey.slice(1);
    }
  }

  // Function to handle option selection
  const handleColorChange = opt => {
    // If the product is already in the cart, remove it so that only one option is active
    if (cartItems.find(item => item.productId === product._id)) {
      dispatch(removeItem({ productId: product._id }));
    }
    setSelectedOption(opt);
  };

  // Auto-select the first available option (that has inventory) if none is selected
  useEffect(() => {
    if (options && options.length > 0 && !selectedOption) {
      const availableOptions = options.filter(
        opt =>
          opt.optionDetails &&
          Object.keys(opt.optionDetails).length > 0 &&
          opt.inventoryData &&
          opt.inventoryData.availableQuantity > 0
      );
      if (availableOptions.length > 0) {
        setSelectedOption(availableOptions[0]);
      }
    }
  }, [options, selectedOption]);
  useEffect(() => { }, []);
  // Assistant context: product detail
  useEffect(() => {
    try {
      dispatch(setAssistantContext({
        pageType: 'product_detail',
        categoryTitle: category?.name || category?.title || null,
        productTitle: product?.title || product?.name || null,
        variantTitle: variant?.name || null,
      }));
    } catch (e) {
      console.warn('Failed to set assistant context (detail)', e);
    }
  }, [dispatch, category?.name, category?.title, product?.title, product?.name, variant?.name]);
  useEffect(() => {
    if (product.category.toLowerCase() == "wraps") {
      cartItems.forEach(item => {
        if (item.productId === product._id) {
          dispatch(setWrapFinish({ productId: product._id, wrapFinish: selectedWrapFinish }));
        }
      });
    }
  }, [cartItems, dispatch, product._id, product.category, selectedWrapFinish]);
  useEffect(() => {
    if (["fbw", "hel"].includes(category.specificCategoryCode)) {
      setIsDisabled(true);
      // router.push('/');
    } else {
    }
  }, [category, router]);

  // --- MERGE IMAGES FROM DESCRIPTION TAB AND COMMON GALLERY ---
  const productImages = useMemo(() => product.images || [], [product.images]);

  const descriptionImages = useMemo(() => {
    let images = [];
    if (category?.showDescriptionImagesInGallery) {
      productInfoTabs.forEach(tab => {
        if (tab.title && tab.title.toLowerCase() === "description" && tab.content && Array.isArray(tab.content.blocks)) {
          tab.content.blocks.forEach(block => {
            if (block.type === "image" && block.data && block.data.file && block.data.file.url) {
              images.push(block.data.file.url.replace("https://d26w01jhwuuxpo.cloudfront.net", ""));
            }
          });
        }
      });
    }
    return images;
  }, [category?.showDescriptionImagesInGallery, productInfoTabs]);

  // Get common gallery images from category
  const commonGalleryImages = useMemo(() => category?.commonGalleryImages || [], [category?.commonGalleryImages]);

  // Robustly get common product card images from variant and category
  const variantCommonCardImages = useMemo(() => {
    try {
      return Array.isArray(variant?.commonProductCardImages) ? variant.commonProductCardImages : [];
    } catch (error) {
      console.warn("Error accessing variant commonProductCardImages:", error);
      return [];
    }
  }, [variant?.commonProductCardImages]);

  const categoryCommonCardImages = useMemo(() => {
    try {
      return Array.isArray(category?.commonProductCardImages) ? category.commonProductCardImages : [];
    } catch (error) {
      console.warn("Error accessing category commonProductCardImages:", error);
      return [];
    }
  }, [category?.commonProductCardImages]);

  // Determine which images to show:
  // If a selected option exists with images, show its first image; otherwise, show product, description, common gallery, and common card images.
  const mergedImages = useMemo(() => {
    try {
      return selectedOption && selectedOption.images && selectedOption.images.length > 0
        ? [selectedOption.images[0]]
        : [...productImages, ...descriptionImages, ...commonGalleryImages, ...variantCommonCardImages, ...categoryCommonCardImages];
    } catch (error) {
      console.error("Error merging images:", error);
      // Fallback to just product images if there's an error
      return productImages || [];
    }
  }, [selectedOption, productImages, descriptionImages, commonGalleryImages, variantCommonCardImages, categoryCommonCardImages]);

  // Prepend the Cloudfront base URL if necessary and filter out invalid images
  const allImages = useMemo(() => {
    try {
      return mergedImages
        .filter(img => {
          // Filter out null, undefined, empty strings, and non-string values
          return img && typeof img === 'string' && img.trim().length > 0;
        })
        .map(img => {
          try {
            // Handle images that already have full URLs or start with /
            if (img.startsWith("http") || img.startsWith("/")) {
              return `${imageBaseUrl}${img.startsWith("/") ? img : "/" + img}`;
            }
            // Handle relative paths
            return `${imageBaseUrl}/${img}`;
          } catch (error) {
            console.warn("Error processing image URL:", img, error);
            return null;
          }
        })
        .filter(Boolean); // Remove any null values from failed processing
    } catch (error) {
      console.error("Error processing image array:", error);
      // Fallback to just product images if there's an error
      const fallbackImages = (product.images || []).filter(img => img && typeof img === 'string');
      return fallbackImages.map(img => `${imageBaseUrl}/${img}`).filter(Boolean);
    }
  }, [mergedImages, imageBaseUrl, product.images]);

  // Determine inventory availability
  const optionInventory =
    selectedOption && selectedOption.inventoryData && typeof selectedOption.inventoryData.availableQuantity === "number"
      ? selectedOption.inventoryData.availableQuantity
      : null;
  const productInventory =
    product.inventoryData && typeof product.inventoryData.availableQuantity === "number"
      ? product.inventoryData.availableQuantity
      : null;

  // Treat on-demand categories (like Wraps) as always in stock
  const isOnDemand = useMemo(() => {
    return (
      category?.inventoryMode === 'on-demand' ||
      (typeof product?.category === 'string' && product.category.toLowerCase() === 'wraps') ||
      (typeof product?.subCategory === 'string' && product.subCategory.toLowerCase().includes('wrap'))
    );
  }, [category?.inventoryMode, product?.category, product?.subCategory]);

  const rawIsOutOfStock =
    optionInventory !== null ? optionInventory <= 0 : productInventory !== null ? productInventory <= 0 : false;
  const isOutOfStock = isOnDemand ? false : rawIsOutOfStock; // On-demand products are never out of stock

  // --- FIRE THE viewContent PIXEL + GA4 view_item ONCE ---
  useEffect(() => {
    if (!hasTracked.current) {
      viewContent(product, { email, phoneNumber });
      try {
        const items = [{
          productId: product._id,
          name: product.name || product.title,
          price: product.price,
          quantity: 1,
          brand: product.brand,
          category: product.category?.name || product.category,
        }];
        const { gaViewItem } = require('@/lib/metadata/googleAds');
        gaViewItem({ value: product.price, items });
      } catch { }
      try {
        const pagePath = typeof window !== 'undefined' ? window.location.pathname : pathname;
        funnelClient.track('view_product', {
          page: {
            path: pagePath,
            name: 'product-id-page',
            category: category?.name || product.category?.name || product.category,
            slug: pagePath?.replace(/^\//, ''),
            title: product?.title || product?.name,
          },
          product: {
            id: product?._id,
            name: product?.name || product?.title,
            price: product?.price,
            brand: product?.brand,
            category: product?.category?.name || product?.category,
            variantId: product?.selectedOption?._id || variant?._id,
          },
          metadata: {
            pageType: 'product-id-page',
            variantId: variant?._id,
          },
          utm: utmDetails,
        });
      } catch (error) {
        // view_product tracking failed
      }
      hasTracked.current = true;
    }
  }, [product, email, phoneNumber, category?.name, pathname, utmDetails, variant?._id]);

  // --- FETCH SOLD COUNT (Optional) ---
  useEffect(() => {
    async function fetchSoldCount() {
      if (!category?._id) return;
      try {
        const response = await fetch(`/api/stats/sales?type=specificCategory&id=${category._id}&days=10&round=true`, {
          next: { revalidate: 1800 },
        });
        const data = await response.json();
        setSoldCount(data.totalItemsSold);
      } catch (error) {
        console.error("Error fetching sold count:", error);
      }
    }
    fetchSoldCount();
  }, [category?._id]);


  // --- MEDIA QUERIES ---
  const isLessThan1000 = useMediaQuery("(max-width: 999px)");
  const isBetween1000And1400 = useMediaQuery("(min-width: 1000px) and (max-width: 1399px)");
  const isGreaterThan1400 = useMediaQuery("(min-width: 1400px)");
  // Mobile devices media query (adjust the max-width as needed)
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Function to compute the style for each option circle
  const getOptionStyle = opt => {
    const style = {
      width: "2.5rem",
      width: "2.5rem",
      height: "2.5rem",
      borderRadius: "50%",
      border: selectedOption && selectedOption._id === opt._id ? "2px solid black" : "none",
      cursor: "pointer",
    };

    if (opt.thumbnail) {
      // If thumbnail exists, use it regardless of option type
      style.backgroundImage = `url(${imageBaseUrl}/${opt.thumbnail})`;
      style.backgroundSize = "cover";
      style.backgroundPosition = "center";
    } else {
      // Fallback: use the option detail value (prefer "color" if available, else first value)
      const optionValue =
        opt.optionDetails && opt.optionDetails.color
          ? opt.optionDetails.color
          : opt.optionDetails
            ? Object.values(opt.optionDetails)[0]
            : null;
      if (optionValue) {
        style.backgroundColor = colorMap[optionValue.toLowerCase()] || optionValue.toLowerCase();
      }
    }
    return style;
  };

  // Helper: Show the prepended selected option if available
  const getDisplayedTitle = () => {
    if (product.category.toLowerCase() === "wraps" && selectedWrapFinish) {
      return `${selectedWrapFinish} ${product.title}`;
    }
    if (!selectedOption || !selectedOption.optionDetails) {
      return product.title;
    }
    // We'll take the first entry from `optionDetails`. In your use case,
    // you might want a specific key, e.g. "flavor", "color", etc.

    const detailValue = Object.values(selectedOption.optionDetails)[0];
    if (!detailValue) {
      return product.title;
    }
    return `${detailValue} ${product.title}`;
  };

  //  thumbnail should reciew images from the selected option if available
  const thumbnail = selectedOption?.images[0] || product?.images[0];

  // Handle variant checking for ProductIdPage
  const handleExternalVariantCheck = async (productToCheck, variants) => {
    try {
      // Check if product has multiple variants by fetching category variants
      const response = await fetch(`/api/features/get-variants?categoryId=${category._id}`);
      const data = await response.json();

      if (data.variants && data.variants.length > 1) {
        // Multiple variants exist, show dialog
        setShowVariantDialog(true);
      } else {
        // Only one variant, redirect directly
        const isB2B = pathname?.startsWith('/b2b');
        const base = isB2B ? '/b2b' : '/shop';

        // Get the product slug part
        const productSlugPart = product.pageSlug.split('/').pop();
        if (data.variants?.[0] && productSlugPart) {
          const targetUrl = `${base}${data.variants[0].pageSlug}/${productSlugPart}`;
          router.push(targetUrl);
        }
      }
    } catch (error) {
      console.error('Error checking variants:', error);
      // Fallback to showing dialog
      setShowVariantDialog(true);
    }
  };

  return (
    <div className={styles.superContainer}>
      {isDisabled && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgb(255, 255, 255)",
            zIndex: 2,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
          }}
        >
          <Typography
            variant="h5"
            sx={{
              textAlign: "center",
              padding: "1rem",
              borderRadius: "10px",
              height: "fit-content",
            }}
          >
            <span style={{ color: "red" }}>Out of stock!</span>
            <br />
            But you might find something you <span style={{ color: "#ff69b4" }}>love!</span> <br />
          </Typography>
          <MemoizedTopBoughtProducts hideHeading={true} pageType="product-id-page" />
          <div>or</div>
          <Link href={"/"} style={{ textDecoration: "none" }}>
            <Typography
              variant="button"
              sx={{
                color: "black",
                fontSize: "1.1rem",
                fontWeight: 600,
                textTransform: "none",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              Explore Homepage
            </Typography>
          </Link>
        </Box>
      )}
      {!isDisabled && (
        <>
          <div className={styles.container}>
            <div className={styles.imageGallery} style={isOutOfStock ? { filter: "grayscale(100%)" } : {}}>
              <MemoizedImageGallery
                src={allImages?.[0] || `${imageBaseUrl}/default-placeholder.jpg`}
                images={allImages}
                isZoomed={isZoomed}
                alt={product.title}
                setIsZoomed={setIsZoomed}
                restrictWidth={product.category.toLowerCase() !== "wraps"}
              />
              {/* Choose Variant Button below ImageGallery */}
              {!isZoomed && category && (
                <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-start", marginLeft: "-1rem" }}>
                  <ChangeVariantButton
                    category={category}
                    product={product}
                    onExternalVariantCheck={handleExternalVariantCheck}
                    hideIfSingleVariant={true}
                    disableAutoPopup={true}
                  />
                </div>
              )}
            </div>
            {/* Hide details if zoomed */}
            {!isZoomed && (
              <div className={styles.productDetails}>
                <div className={styles.details}>
                  {/* Here we prepend the selected option's value to the product name */}
                  <h1 className={styles.title}>{getDisplayedTitle()}</h1>

                  {/* Product Sold Count */}
                  <div className={styles.soldCountContainer}>
                    <span className={styles.fireEmoji}>🔥</span>
                    <span className={styles.soldCountText}>
                      {soldCount !== null
                        ? soldCount < 20
                          ? "20+ sold in last 10 days"
                          : `${soldCount}+ sold in last 10 days`
                        : "Loading sold count..."}

                    </span>
                  </div>

                  {/* <AddToCartButton
                    product={product}
                    enableVariantSelection
                    hideRecommendationPopup
                    showOnlyChooseVariants
                    size="small"
                  /> */}
                  {variant?.cardCaptions?.[0] && (
                    <p style={{ marginTop: "-0.5rem", marginLeft: "0.3rem" }} className={styles.cardCaption}>
                      {variant.cardCaptions[0]}
                    </p>
                  )}
                </div>

                {/* Render options using OptionSelector */}
                {options &&
                  (
                    // For on-demand categories, don't require inventory to show options
                    (isOnDemand && options.some(opt => opt.optionDetails && Object.keys(opt.optionDetails).length > 0)) ||
                    (!isOnDemand && options.some(
                      opt =>
                        opt.optionDetails &&
                        Object.keys(opt.optionDetails).length > 0 &&
                        opt.inventoryData &&
                        opt.inventoryData.availableQuantity > 0
                    ))
                  ) && (
                    <OptionSelector
                      options={isOnDemand
                        ? options.filter(
                          opt => opt.optionDetails && Object.keys(opt.optionDetails).length > 0
                        )
                        : options.filter(
                          opt =>
                            opt.optionDetails &&
                            Object.keys(opt.optionDetails).length > 0 &&
                            opt.inventoryData &&
                            opt.inventoryData.availableQuantity > 0
                        )}
                      selectedOption={selectedOption}
                      handleOptionChange={handleColorChange}
                      optionLabel={optionLabel}
                      colorMap={colorMap}
                      imageBaseUrl={imageBaseUrl}
                      isMobile={isMobile}
                    />
                  )}

                {/* Render wrap finish selector for wraps */}
                {product.category.toLowerCase() === "wraps" && (
                  <WrapFinishSelector selectedFinish={selectedWrapFinish} setSelectedFinish={setSelectedWrapFinish} />
                )}

                {isMobile && (
                  <>
                    {product.specificCategory === "673aea6778c57ec01acae635" && (
                      <Link href={memoizedProductListPageLink} className={styles.offerAdContainer}>
                        <Image
                          src={`${imageBaseUrl}/assets/posters/tankbundlephone.png`}
                          alt="Bike Bundle offer PC"
                          width={1024}
                          height={200}
                          className={styles.bikeBundleImage}
                        />
                      </Link>
                    )}
                    {product.specificCategory === "685be144d656a52f5754e667" && (
                      <Link href={memoizedProductListPageLink} className={styles.offerAdContainer}>
                        <Image
                          src={`${imageBaseUrl}/assets/posters/mat_phone.jpg`}
                          alt="Mat Bundle offer Mobile"
                          width={1024}
                          height={200}
                          className={styles.bikeBundleImage}
                        />
                      </Link>
                    )}
                    {product.specificCategory === "67d95873451481014c7d0bb2" && (
                      <Link href={memoizedProductListPageLink} className={styles.offerAdContainer}>
                        <Image
                          src={`${imageBaseUrl}/assets/posters/freshener_offer_phone.jpg`}
                          alt="Freshener Bundle offer Mobile"
                          width={1024}
                          height={200}
                          className={styles.bikeBundleImage}
                        />
                      </Link>
                    )}
                    <div className={styles.orderSpecificationsContainer}>
                      <MemoizedOrderSpecifications features={variant.features} justContStart={true} />
                    </div>
                  </>
                )}

                <div className={styles.priceSection}>
                  <span className={styles.currentPrice}>₹{finalPrice}</span>
                  <span className={styles.mrp}>₹{mrp}</span>
                  <span className={styles.discountPercentage}>{discountPercent}% off</span>
                </div>

                {!isMobile && (
                  <>
                    {product.specificCategory === "673aea6778c57ec01acae635" && (
                      <Link href={memoizedProductListPageLink} className={styles.offerAdContainer}>
                        <Image
                          src={`${imageBaseUrl}/assets/posters/tankbundlepc.png`}
                          alt="Bike Bundle offer PC"
                          width={1024}
                          height={200}
                          className={styles.bikeBundleImage}
                        />
                      </Link>
                    )}
                    {product.specificCategory === "685be144d656a52f5754e667" && (
                      <Link href={memoizedProductListPageLink} className={styles.offerAdContainer}>
                        <Image
                          src={`${imageBaseUrl}/assets/posters/mat_pc.jpg`}
                          alt="Mat Bundle offer PC"
                          width={1024}
                          height={200}
                          className={styles.bikeBundleImage}
                        />
                      </Link>
                    )}
                    {product.specificCategory === "67d95873451481014c7d0bb2" && (
                      <Link href={memoizedProductListPageLink} className={styles.offerAdContainer}>
                        <Image
                          src={`${imageBaseUrl}/assets/posters/freshener_offer_pc.jpg`}
                          alt="Freshener Bundle offer PC"
                          width={1024}
                          height={200}
                          className={styles.bikeBundleImage}
                        />
                      </Link>
                    )}
                    <div className={styles.orderSpecificationsContainer}>
                      <MemoizedOrderSpecifications features={variant.features} justContStart={true} />
                    </div>
                  </>
                )}

                {/* Render Add to Cart Button only if in stock */}
                {!isDisabled && (
                  <div className={styles.buttonDiv}>
                    <MemoizedAddToCartButtonWithOrder
                      product={{
                        ...product,
                        thumbnail,
                        selectedOption: selectedOption || null,
                        wrapFinish: product.category.toLowerCase() === "wraps" ? selectedWrapFinish : null,
                        variantDetails: variant,
                        category: category,
                        price:
                          variant?.availableBrands?.length > 0
                            ? variant.availableBrands[0].brandBasePrice + product.price
                            : product.price,
                      }}
                      isLarge={true}
                      insertionDetails={insertionDetails}
                    />
                  </div>
                )}
              </div>
            )}
          </div>


          {/* Product description & additional details */}
          <MemoizedProductDescription
            productInfoTabs={productInfoTabs}
            showProductImageFirst={false}
            showFullDescription={true}
          />

          {/* Collage large image (responsive) */}
          <Image src={'/images/assets/customer-collage.png'} alt="Happy Customers Collage" width={1000} height={1000} className={styles.collageImage} />

          <MemoizedReviewFullComp
            productId={product._id}
            variantId={variant._id}
            categoryId={category._id}
            fetchReviewSource={category.reviewFetchSource}
            variant={variant}
          />

          {/* Similar Products Section */}
          <SimilarProducts currentProduct={product} variant={variant} category={category} />

          {/* Showcase of top products, reviews, etc. */}
          <MemoizedTopBoughtProducts
            subCategories={[category?.subCategory]}
            excludeProductIds={[product?._id]}
            pageType="product-id-page"
          />
        </>
      )}

      {/* Variant Selection Dialog */}
      <VariantSelectionDialog
        open={showVariantDialog}
        onClose={() => setShowVariantDialog(false)}
        category={category}
        product={product}
        mode="search" // Use search mode for product description page redirection
      />
    </div>
  );
}
