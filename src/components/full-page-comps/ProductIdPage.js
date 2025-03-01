"use client";

import React, { useState, useEffect, useRef, memo } from "react";
import styles from "./styles/productid.module.css";
import { useSelector } from "react-redux";
import OrderSpecifications from "../page-sections/product-id-page/OrderSpecifications";
import PriceAndChat from "../page-sections/product-id-page/PriceAndChat";
import HappyCustomersClient from "../showcase/sliders/HappyCustomerClient";
import { viewContent } from "@/lib/metadata/facebookPixels";
import ContactUs from "../layouts/ContactUs";
import AddToCartButtonWithOrder from "../utils/AddToCartButtonWithOrder";
import ImageGallery from "../page-sections/product-id-page/ImageGallery";
import ReviewFullComp from "../page-sections/product-id-page/ReviewFullComp";
import ProductDescription from "../page-sections/product-id-page/ProductInfoTab";
import { TopBoughtProducts } from "../showcase/products/TopBoughtProducts";
import Footer from "../layouts/Footer";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import useMediaQuery from "@mui/material/useMediaQuery";

// Memoize components that do not need to update on option change
const MemoizedImageGallery = memo(ImageGallery);
const MemoizedOrderSpecifications = memo(OrderSpecifications);
const MemoizedPriceAndChat = memo(PriceAndChat);
const MemoizedProductDescription = memo(ProductDescription);
const MemoizedTopBoughtProducts = memo(TopBoughtProducts);
const MemoizedReviewFullComp = memo(ReviewFullComp);
const MemoizedAddToCartButtonWithOrder = memo(AddToCartButtonWithOrder);

export default function ProductIdPage({
  product,
  variant,
  category,
  description,
  productInfoTabs = [],
  options = [] // Options are expected to come with image data and optionDetails (e.g., color)
}) {
  // -- ADD OUR COLOR MAP HERE --
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
    gray: "#cccccc"
  };

  const [isZoomed, setIsZoomed] = useState(false);
  const [soldCount, setSoldCount] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const userDetails = useSelector((state) => state.orderForm.userDetails);
  const { email, phoneNumber } = userDetails || {};
  const hasTracked = useRef(false);

  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // Auto-select the first option if any exist
  useEffect(() => {
    if (options && options.length > 0 && !selectedOption) {
      setSelectedOption(options[0]);
    }
  }, [options, selectedOption]);

  // --- MERGE IMAGES FROM DESCRIPTION TAB ---
  const productImages = product.images || [];
  let descriptionImages = [];

  productInfoTabs.forEach((tab) => {
    if (
      tab.title &&
      tab.title.toLowerCase() === "description" &&
      tab.content &&
      Array.isArray(tab.content.blocks)
    ) {
      tab.content.blocks.forEach((block) => {
        if (
          block.type === "image" &&
          block.data &&
          block.data.file &&
          block.data.file.url
        ) {
          descriptionImages.push(
            block.data.file.url.replace(
              "https://d26w01jhwuuxpo.cloudfront.net",
              ""
            )
          );
        }
      });
    }
  });
  console.log("Description images:", descriptionImages);

  // Determine which images to show:
  // - If the product has options, use the images from the selected option (if any)
  // - Otherwise, use product images merged with description images
  const mergedImages =
    options && options.length > 0
      ? (selectedOption?.images && selectedOption.images.length > 0
          ? selectedOption.images
          : descriptionImages)
      : [...productImages, ...descriptionImages];

  console.log({ mergedImages });

  // Prepend the Cloudfront base URL if necessary
  const allImages = mergedImages.map((img) =>
    img.startsWith("http") || img.startsWith("/")
      ? `${imageBaseUrl}${img.startsWith("/") ? img : "/" + img}`
      : `${imageBaseUrl}/${img}`
  );

  // --- FIRE THE viewContent PIXEL ONCE ---
  useEffect(() => {
    if (!hasTracked.current) {
      viewContent(product, { email, phoneNumber });
      hasTracked.current = true;
    }
  }, [product, email, phoneNumber]);

  // --- FETCH SOLD COUNT (Optional) ---
  useEffect(() => {
    async function fetchSoldCount() {
      if (!category?._id) return;
      try {
        const response = await fetch(
          `/api/stats/sales?type=specificCategory&id=${category._id}&days=10&round=true`
        );
        const data = await response.json();
        setSoldCount(data.totalItemsSold);
      } catch (error) {
        console.error("Error fetching sold count:", error);
      }
    }
    fetchSoldCount();
  }, [category?._id]);

  const soldByCategoryEl = (
    <div className={styles.soldByCategory}>
      <TrendingUpIcon sx={{ color: "green", marginRight: "5px" }} />
      {soldCount !== null
        ? soldCount < 20
          ? "20+ sold in last 10 days"
          : `${soldCount}+ sold in last 10 days`
        : "Loading sold count..."}
    </div>
  );

  // --- MEDIA QUERIES ---
  const isLessThan1000 = useMediaQuery("(max-width: 999px)");
  const isBetween1000And1400 = useMediaQuery(
    "(min-width: 1000px) and (max-width: 1399px)"
  );
  const isGreaterThan1400 = useMediaQuery("(min-width: 1400px)");

  return (
    <div style={{ paddingBottom: "6rem" }}>
      <div className={styles.container}>
        <div className={styles.imageGallery}>
          <MemoizedImageGallery
            src={allImages?.[0] || `${imageBaseUrl}/default-placeholder.jpg`}
            images={allImages}
            isZoomed={isZoomed}
            alt={product.title}
            setIsZoomed={setIsZoomed}
          />
          {isBetween1000And1400 && soldByCategoryEl}
        </div>

        {/* Hide details if zoomed */}
        {!isZoomed && (
          <div className={styles.productDetails}>
            <div className={styles.details}>
              <h1 className={styles.title}>{product.title}</h1>
              {variant?.cardCaptions?.[0] && (
                <p
                  style={{ marginTop: "-0.5rem", marginLeft: "0.3rem" }}
                  className={styles.cardCaption}
                >
                  {variant.cardCaptions[0]}
                </p>
              )}
            </div>

            <MemoizedPriceAndChat
              price={
                variant?.availableBrands?.length > 0
                  ? variant.availableBrands[0].brandBasePrice + product.price
                  : product.price
              }
            />

            <div className={styles.orderSpecificationsContainer}>
              <MemoizedOrderSpecifications
                features={variant.features}
                justContStart={true}
              />
            </div>

            {/* Render color options if available */}
            {options &&
              options.some(
                (opt) =>
                  opt.optionDetails &&
                  opt.optionDetails.color &&
                  opt.optionDetails.color.trim()
              ) && (
                <div style={{ margin: "1rem 0" }}>
                  <div style={{ marginBottom: "0.5rem" }}>More colors</div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {options
                      .filter(
                        (opt) =>
                          opt.optionDetails &&
                          opt.optionDetails.color &&
                          opt.optionDetails.color.trim()
                      )
                      .map((opt) => (
                        <div
                          key={opt._id}
                          onClick={() => setSelectedOption(opt)}
                          style={{
                            width: "2rem",
                            height: "2rem",
                            borderRadius: "50%",
                            border:
                              selectedOption && selectedOption._id === opt._id
                                ? "2px solid black"
                                : "none",
                            backgroundColor:
                              colorMap[
                                opt.optionDetails.color.toLowerCase()
                              ] ||
                              opt.optionDetails.color.toLowerCase(),
                            cursor: "pointer"
                          }}
                        />
                      ))}
                  </div>
                </div>
              )}

            <div className={styles.buttonDiv}>
              <MemoizedAddToCartButtonWithOrder
                product={{
                  ...product,
                  selectedOption: selectedOption || null,
                  variantDetails: variant,
                  category: category,
                  price:
                    variant?.availableBrands?.length > 0
                      ? variant.availableBrands[0].brandBasePrice + product.price
                      : product.price
                }}
                isLarge={true}
              />
            </div>

            {isGreaterThan1400 && soldByCategoryEl}
            {isLessThan1000 && soldByCategoryEl}
          </div>
        )}
      </div>

      {/* Pass your SSR “productInfoTabs” into ProductDescription */}
      <MemoizedProductDescription
        productInfoTabs={productInfoTabs}
        showProductImageFirst={false}
      />

      {/* Showcase of top products, reviews, etc. */}
      <MemoizedTopBoughtProducts
        subCategories={[category?.subCategory]}
        excludeProductIds={[product?._id]}
      />
      <MemoizedReviewFullComp
        productId={product._id}
        variantId={variant._id}
        categoryId={category._id}
        fetchReviewSource={category.reviewFetchSource}
        variant={variant}
      />
    </div>
  );
}
