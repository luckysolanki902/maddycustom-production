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
    // Check inventory: consider out of stock if availableQuantity is 0 or undefined/null
    const inventoryAvailable = product.inventoryData?.availableQuantity;
    outOfStock = outOfStock || inventoryAvailable === 0 || inventoryAvailable === undefined || inventoryAvailable === null;
    return { imageUrl: product.images[0], outOfStock };
  }

  // 2) Check if any option has images
  if (product.options && product.options.length > 0) {
    for (const option of product.options) {
      if (option.images && option.images.length > 0) {
        // Check option inventory
        const optionInventoryAvailable = option.inventoryData?.availableQuantity;
        outOfStock = outOfStock || optionInventoryAvailable === 0 || optionInventoryAvailable === undefined || optionInventoryAvailable === null;
        return { imageUrl: option.images[0], outOfStock };
      }
    }
  }

  // 3) Fallback
  return { imageUrl: null, outOfStock: true };
}

const ProductCard = ({ product, isLoading, showLayout2, hideCartButton = false, hidePrice = false, offerTaglineText, pageType }) => {
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

  // Debug log for out of stock detection (remove after testing)
  if (process.env.NODE_ENV === 'development' && outOfStock) {
    console.log('Out of stock product detected:', {
      name: product.name,
      variantAvailable: product?.variantDetails?.available,
      categoryAvailable: product?.category?.available,
      inventoryQuantity: product.inventoryData?.availableQuantity,
      outOfStock
    });
  }

  // Auto-detect if images are square by checking the actual dimensions
  // This is a more robust approach than relying on listLayout
  const isSquareLayout = useMemo(() => {
    // If listLayout explicitly says square, use it
    if (product.variantDetails?.listLayout === '3') return true;
    
    // Auto-detect based on product category or name
    if (product.category?.name?.toLowerCase().includes('steering')) return true;
    if (product.name?.toLowerCase().includes('steering')) return true;
    if (imageUrl && imageUrl.toLowerCase().includes('steering')) return true;
    
    // Check if it's a car interior product that's likely square
    if (product.category?.specificCategoryCode === 'sc') return true; // steering covers
    if (product.variantDetails?.pageSlug?.includes('steering')) return true;
    
    // Default to false for other cases
    return false;
  }, [product.variantDetails?.listLayout, imageUrl, product.category, product.name, product.variantDetails?.pageSlug]);

  // Determine additional CSS classes based on product type
  const getProductTypeClasses = () => {
    let classes = [];
    if (isSquareLayout) classes.push(styles.squareLayoutCard);
    if (product.category?.name?.toLowerCase().includes('steering')) classes.push(styles.steeringCoverCard);
    if (showLayout2) classes.push(styles.layout2Card);
    return classes.join(' ');
  };

  // Final src for Next/Image
  let finalSrc = '/images/assets/gifs/helmetloadinggiflandscape2.gif';
  if (imageUrl) {
    finalSrc = imageUrl.startsWith('/')
      ? `${baseImageUrl}${imageUrl}`
      : `${baseImageUrl}/${imageUrl}`;
  }

  return (
    <div
      className={`${styles.mainCardDiv} ${getProductTypeClasses()}`}
      onClick={navigateToProductPage}
    >
      {offerTaglineText && (
        <div className={styles.fixedTagline}>
          {offerTaglineText}
        </div>
      )}

      <div className={`${styles.imageContainer} ${isSquareLayout ? styles.squareImageContainer : ''}`}>
        <Image
          className={`${styles.image} ${isSquareLayout ? styles.squareImage : ''}`}
          src={finalSrc}
          alt={product.name}
          width={isSquareLayout ? 1080 : 1076}
          height={isSquareLayout ? 1080 : 683}
          loading="lazy"
          title={product.title}
          style={{ 
            filter: outOfStock ? 'grayscale(30%)' : 'none',
            opacity: outOfStock ? 0.95 : 1
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

        {!hideCartButton && (
          <div className={styles.addToCart} onClick={(e) => e.stopPropagation()}>
            <AddToCartButton
              product={{
                ...product,
                thumbnail: imageUrl,
                selectedOption: product.options ? product.options[0] : null,
                price: finalPrice,
              }}
              insertionDetails={insertionDetails}
              flexResponsiveness={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProductCard);
