"use client";
import React, { useMemo } from 'react';
import Image from 'next/image';
import styles from './styles/productcard.module.css';
import { useMediaQuery } from '@mui/material';
import { useRouter } from 'next/navigation';
import AddToCartButton from '../utils/AddToCartButton';

// Helper to decide which image to show
function getDisplayImage(product) {
  // Initialize outOfStock based on initial validation
  let outOfStock = !product?.variantDetails?.available || !product?.category?.available;

  // 1) Check the product's own images
  if (product.images && product.images.length > 0) {
    outOfStock = outOfStock || product.inventoryData?.availableQuantity === 0;
    return { imageUrl: product.images[0], outOfStock };
  }

  // 2) Check if any option has images
  if (product.options && product.options.length > 0) {
    for (const option of product.options) {
      if (option.images && option.images.length > 0) {
        outOfStock = outOfStock || option.inventoryData?.availableQuantity === 0;
        return { imageUrl: option.images[0], outOfStock };
      }
    }
  }

  // 3) Fallback
  return { imageUrl: null, outOfStock: true };
}

const ProductCard = ({ product, isLoading, showLayout2, hideCartButton = false, hidePrice = false, offerTaglineText, pageType, productRefs, selectedProductId }) => {
  const insertionDetails = {
    component: 'productCard',
    pageType: pageType || 'unknown',
  };
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const router = useRouter();
  
  // pull MRP & final price, then memoize discount%
  const mrp = product.MRP ?? 1000;
  const finalPrice = product.variantDetails?.availableBrands?.length > 0
    ? product.variantDetails.availableBrands[0].brandBasePrice + product.price
    : product.price;
  const discountPercent = useMemo(() =>
    Math.round(((mrp - finalPrice) / mrp) * 100)
    , [mrp, finalPrice]);

  // Navigate to product detail
  const navigateToProductPage = () => {
    if (product.variantDetails?.available) {
      router.push(`/shop/${product.pageSlug}`);
    }
  };

  // Determine which image to display
  const { imageUrl, outOfStock } = getDisplayImage(product);

  // Final src for Next/Image
  let finalSrc = '/images/assets/gifs/helmetloadinggiflandscape2.gif';
  if (imageUrl) {
    finalSrc = imageUrl.startsWith('/')
      ? `${baseImageUrl}${imageUrl}`
      : `${baseImageUrl}/${imageUrl}`;
  }

  return (
    <div
      ref={(el) => {
        if (product._id === selectedProductId) {
          productRefs.current[product._id] = el;
        }
      }}
      className={`${styles.mainCardDiv} ${showLayout2 ? styles.layout2Card : ''}`}
      onClick={navigateToProductPage}
    >
      {offerTaglineText && (
        <div className={styles.fixedTagline}>
          {offerTaglineText}
        </div>
      )}

      <div className={styles.imageContainer}>
        <Image
          className={styles.image}
          src={finalSrc}
          alt={product.name}
          width={1076}
          height={683}
          loading="lazy"
          title={product.title}
          style={{ 
            filter: outOfStock ? 'grayscale(100%)' : 'none',
            opacity: outOfStock ? 0.9 : 1
          }}
        />
        {outOfStock && (
          <div className={styles.outOfStockOverlay}>
            <span>Out of Stock</span>
          </div>
        )}
      </div>

      <div className={styles.productDescription}>
        <h3 className={styles.productName}>{product.name}</h3>

        <div className={styles.productCardSubtitles}>
          {product.variantDetails?.cardCaptions?.map((caption, index) => {
            const charLimit = 48;
            const shortenedString = caption.length > charLimit
              ? caption.slice(0, charLimit) + '...more'
              : caption;
            return (
              <p key={index} className={styles.captionText}>{shortenedString}</p>
            );
          })}
        </div>

        {!hidePrice && (
          <div className={styles.priceSection}>
            <span className={styles.finalPrice}>₹{finalPrice}</span>
            <div className={styles.priceDetails}>
              <div className={styles.priceRow}>
                <span className={styles.mrp}>₹{mrp}</span>
                <span className={styles.discountPercentage}>{discountPercent}% off</span>
              </div>
              <div className={styles.offerSubtitle}>on every order</div>
            </div>
          </div>
        )}

        {product.variantDetails?.available && !outOfStock && !hideCartButton && (
          <div className={styles.addToCart}>
            <AddToCartButton
              product={{
                ...product,
                thumbnail: imageUrl,
                selectedOption: product.options ? product.options[0] : null,
                price: finalPrice,
              }}
              insertionDetails={insertionDetails}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProductCard);
