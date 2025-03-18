"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import styles from './styles/productcard.module.css';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { useMediaQuery, Typography } from '@mui/material';
import { useSpring, animated } from '@react-spring/web';
import { useRouter } from 'next/navigation';
import AddToCartButton from '../utils/AddToCartButton';

// Helper to decide which image to show
function getDisplayImage(product) {
  // 1) Check the product's own images
  if (product.images && product.images.length > 0) {
    const outOfStock = product.inventoryData?.availableQuantity === 0;
    return { imageUrl: product.images[0], outOfStock };
  }
  // 2) Check if any option has images
  if (product.options && product.options.length > 0) {
    for (const option of product.options) {
      if (option.images && option.images.length > 0) {
        const outOfStock = option.inventoryData?.availableQuantity === 0;
        return { imageUrl: option.images[0], outOfStock };
      }
    }
  }
  // 3) Fallback
  return { imageUrl: null, outOfStock: true };
}

const ProductCard = ({ product, isLoading, showLayout2, hideCartButton = false }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const [isZoomed, setIsZoomed] = useState(false);
  const router = useRouter();

  // Zoom animation
  const animationProps = useSpring({
    transform: isZoomed ? 'scale(2) rotate(90deg)' : 'scale(1) rotate(0deg)',
    config: { tension: 300, friction: 20 },
  });

  const overlayProps = useSpring({
    opacity: isZoomed ? 1 : 0,
    pointerEvents: isZoomed ? 'auto' : 'none',
    config: { duration: 200 },
  });

  const handleImageClick = (e) => {
    e.stopPropagation();
    setIsZoomed(true);
  };

  const handleOverlayClick = () => {
    setIsZoomed(false);
  };

  // Handle back button for zoom
  const handlePopState = useCallback(
    (e) => {
      if (isZoomed) {
        e.preventDefault();
        setIsZoomed(false);
      }
    },
    [isZoomed]
  );

  useEffect(() => {
    if (isZoomed) {
      window.history.pushState({ zoomed: true }, '');
      window.addEventListener('popstate', handlePopState);
    } else {
      if (window.history.state && window.history.state.zoomed) {
        window.history.back();
      }
      window.removeEventListener('popstate', handlePopState);
    }
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isZoomed, handlePopState]);

  // Navigate to product detail
  const navigateToProductPage = () => {
    if (product.variantDetails?.available) {
      router.push(`/shop/${product.pageSlug}`);
    }
  };

  // Determine which image to display
  const { imageUrl, outOfStock } = getDisplayImage(product);

  // Final src for Next/Image
  // If isLoading is true and we *haven't* got an imageUrl => show the helmetloading gif
  let finalSrc = '/images/assets/gifs/helmetloadinggiflandscape2.gif';
  if (imageUrl) {
    // Construct properly
    finalSrc = imageUrl.startsWith('/')
      ? `${baseImageUrl}${imageUrl}`
      : `${baseImageUrl}/${imageUrl}`;
  }

  return (
    <div
      className={styles.mainCardDiv}
      style={{ cursor: isZoomed ? 'default' : 'pointer', backgroundColor: 'white' }}
      onClick={() => {
        if (!isZoomed) {
          navigateToProductPage();
        }
      }}
    >
      {/* Tap to Zoom overlay for small device */}
      {/* {isSmallDevice && !isZoomed && (
        <div
          className={styles.taptozoom}
          onClick={handleImageClick}
        >
          <ZoomOutMapIcon style={{ marginRight: '1rem', fontSize: '1.1rem', color: 'gray' }} />
          <span>Tap to Zoom</span>
        </div>
      )} */}

      {/* Zoom Overlay */}
      <animated.div
        style={{
          ...overlayProps,
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 3000,
        }}
        onClick={handleOverlayClick}
      >
        {isZoomed && (
          <div style={{ position: 'relative', cursor: 'zoom-out' }}>
            <animated.div style={animationProps}>
              <Image
                src={finalSrc}
                alt={product.name}
                width={1076}
                height={683}
                loading="lazy"
                title={product.title}
                style={outOfStock ? { filter: 'grayscale(100%)' } : {}}
              />
              {outOfStock && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                  }}
                >
                  Item Out of Stock
                </div>
              )}
            </animated.div>
          </div>
        )}
      </animated.div>

      {/* Non-zoomed image */}
      {!isZoomed && (
        <animated.div style={animationProps}>
          <Image
            className={styles.image}
            src={finalSrc}
            alt={product.name}
            width={1076}
            height={683}
            loading="lazy"
            title={product.title}
            style={outOfStock ? { filter: 'grayscale(100%)' } : {}}
          />
          {outOfStock && (
            <div className={styles.outOfStockOverlay}>
              <Typography variant="body2" color="error">
                Item Out of Stock
              </Typography>
            </div>
          )}
        </animated.div>
      )}

      <div className={styles.productDescription}>
        <div className={styles.prodDescRow1}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className={styles.productName}>{product.name}</div>
          </div>
        </div>

        <div className={styles.prodDescRow2}>
          <div className={styles.productCardSubtitles}>
            {product.variantDetails?.cardCaptions?.map((caption, index) => (
              <React.Fragment key={index}>
                <span>{caption}</span>
                <br />
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className={styles.prodDescRow3}>
          <div className={styles.price}>
            <span className={styles.rupees}>₹</span>
            <span className={styles.priceValue}>
              {product.variantDetails?.availableBrands?.length > 0
                ? product.variantDetails.availableBrands[0].brandBasePrice + product.price
                : product.price}
            </span>
          </div>
          <div className={styles.offer5}>
            <div className={styles.offer5Line1}>
              <span>5%</span>
              <span style={{ marginLeft: '0.4rem' }}>off</span>
            </div>
          </div>
        </div>

        <div className={styles.prodDescLastRow}>
          {/* Condition: If variant is available and not out of stock => show AddToCart */}
          {product.variantDetails?.available && !outOfStock && !hideCartButton && (
            <div className={styles.addToCart}>
              <AddToCartButton
                product={{
                  ...product,
                  selectedOption: product.options ? product.options[0] : null,
                  price: product.variantDetails?.availableBrands?.length > 0
                    ? product.variantDetails.availableBrands[0].brandBasePrice + product.price
                    : product.price,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProductCard);
