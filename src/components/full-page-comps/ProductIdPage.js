"use client";

import styles from "./styles/productid.module.css";
import { useState, useEffect, useRef } from "react";
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

export default function ProductIdPage({
  product,
  variant,
  category,
  description,
  productInfoTabs = [],
}) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [soldCount, setSoldCount] = useState(null);
  const userDetails = useSelector((state) => state.orderForm.userDetails);
  const { email, phoneNumber } = userDetails || {};
  const hasTracked = useRef(false);

  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // --- MERGE IMAGES FROM PRODUCT AND DESCRIPTION TAB ---
  // Product images as stored in the product document.
  const productImages = product.images || [];

  // Extract images from the "Description" product info tab content.
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
          descriptionImages.push(block.data.file.url.replace('https://d26w01jhwuuxpo.cloudfront.net', ''));
        }
      });
    }
  });
  console.log(descriptionImages);

  // Merge images: product images, images extracted from "Description" tab,
  // and any extra appendedImages (if provided).
  const mergedImages = [
    ...productImages,
    ...descriptionImages,
  ];

  console.log({mergedImages});

  // Prepend the Cloudfront base URL if necessary.
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
          <ImageGallery
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

            <PriceAndChat
              price={
                variant?.availableBrands?.length > 0
                  ? variant.availableBrands[0].brandBasePrice + product.price
                  : product.price
              }
            />

            <div className={styles.orderSpecificationsContainer}>
              <OrderSpecifications
                features={variant.features}
                justContStart={true}
              />
            </div>

            <div className={styles.buttonDiv}>
              <AddToCartButtonWithOrder
                product={{
                  ...product,
                  variantDetails: variant,
                  category: category,
                  price:
                    variant?.availableBrands?.length > 0
                      ? variant.availableBrands[0].brandBasePrice + product.price
                      : product.price,
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
      <ProductDescription
        productInfoTabs={productInfoTabs}
        showProductImageFirst={false} // set to true if you want a leading product image from the description tab
      />

      {/* Showcase of top products, reviews, etc. */}
      <TopBoughtProducts
        subCategories={[category?.subCategory]}
        excludeProductIds={[product?._id]}
      />
      <ReviewFullComp
        productId={product._id}
        variantId={variant._id}
        categoryId={category._id}
        fetchReviewSource={category.reviewFetchSource}
        variant={variant}
      />
    </div>
  );
}
