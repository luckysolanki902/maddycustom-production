'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import styles from './styles/productcard.module.css';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { useMediaQuery } from '@mui/material';
import { useSpring, animated } from '@react-spring/web';
import { useRouter } from 'next/navigation';
import AddToCartButton from '../utils/AddToCartButton';
import {Typography} from '@mui/material';
// Helper function to decide which image to show and whether it's out of stock.
const getDisplayImage = (product) => {
  // 1. Check if product has its own images.
  if (product.images && product.images.length > 0) {
    if (product.inventoryData && product.inventoryData.availableQuantity === 0) {
      return { imageUrl: product.images[0], outOfStock: true };
    }
    return { imageUrl: product.images[0], outOfStock: false };
  }
  // 2. Otherwise, check through options.
  if (product.options && product.options.length > 0) {
    // Try to find an option with images and available stock.
    for (const option of product.options) {
      if (option.images && option.images.length > 0) {
        if (option.inventoryData) {
          if (option.inventoryData.availableQuantity > 0) {
            return { imageUrl: option.images[0], outOfStock: false };
          }
        } else {
          // No inventory ref, so assume it's available.
          return { imageUrl: option.images[0], outOfStock: false };
        }
      }
    }
    // If none of the options have available stock but at least one has images, return the first option's image as out of stock.
    for (const option of product.options) {
      if (option.images && option.images.length > 0) {
        return { imageUrl: option.images[0], outOfStock: true };
      }
    }
  }
  // 3. Fallback placeholder
  return { imageUrl: '/images/assets/gifs/helmetloadinggif.gif', outOfStock: true };
};

const ProductCard = ({ product, loading, showLayout2 }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const [isZoomed, setIsZoomed] = useState(false);
  const router = useRouter();

  console.log(product);

  // Define the animation properties using React Spring
  const animationProps = useSpring({
    transform: isZoomed ? 'scale(2) rotate(90deg)' : 'scale(1) rotate(0deg)',
    config: { tension: 300, friction: 20 },
  });

  // Overlay properties when zoomed
  const overlayProps = useSpring({
    opacity: isZoomed ? 1 : 0,
    pointerEvents: isZoomed ? 'auto' : 'none',
    config: { duration: 200 },
  });

  const handleImageClick = () => {
    setIsZoomed(true);
  };

  const handleOverlayClick = () => {
    setIsZoomed(false);
  };

  // Handle Back Button Behavior for zoomed image
  const handlePopState = useCallback(
    (event) => {
      if (isZoomed) {
        event.preventDefault();
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

  // Handle navigation to product page
  const navigateToProductPage = () => {
    if (product.variantDetails.available) {
      router.push(`/shop/${product.pageSlug}`);
    }
  };

  // Determine which image to display using our helper function.
  const { imageUrl, outOfStock } = getDisplayImage(product);

  return (
    <div
      id={product._id}
      className={styles.mainCardDiv}
      onClick={() => {
        if (!isZoomed) {
          navigateToProductPage();
        }
      }}
      style={{ cursor: isZoomed ? 'default' : 'pointer', backgroundColor: 'white' }} // Change cursor based on zoom state
    >
      {/* {isSmallDevice && !isZoomed && (
        <div
          className={styles.taptozoom}
          onClick={(e) => {
            e.stopPropagation();
            handleImageClick();
          }}
        >
          <ZoomOutMapIcon style={{ marginRight: '1rem', fontSize: '1.1rem', color: 'gray' }} />
          <span>Tap to Zoom</span>
        </div>
      )} */}

      {/* Overlay for zoomed image */}
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
                unoptimized={false}
                src={
                  imageUrl.startsWith('/')
                    ? `${baseImageUrl}${imageUrl}`
                    : `${baseImageUrl}/${imageUrl}`
                }
                alt={product.name}
                width={1076}
                height={683}
                loading="lazy"
                title={product.title}
                aria-describedby={product.description}
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

      {/* Regular image with animation */}
      {!isZoomed && (
        <animated.div style={animationProps}>
          <Image
            className={styles.image}
            unoptimized={loading ? true : false}
            src={
              loading
                ? '/images/assets/gifs/helmetloadinggiflandscape2.gif'
                : imageUrl
                  ? (imageUrl.startsWith('/') ? `${baseImageUrl}${imageUrl}` : `${baseImageUrl}/${imageUrl}`)
                  : '/images/assets/gifs/helmetloadinggiflandscape2.gif'
            }
            alt={product.name}
            width={1076}
            height={683}
            loading="lazy"
            title={product.title}
            aria-describedby={product.description}
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
          <div className={styles.prodDescRow1} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className={styles.productName}>{product.name}</div>
          </div>

        </div>
        <div className={styles.prodDescRow2}>
          <div className={styles.productCardSubtitles}>
            {product.variantDetails.cardCaptions?.map((caption, index) => (
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
          {/* <Image
            width={500}
            height={250}
            src={
              `${baseImageUrl}${product.variantDetails.available ? '/assets/icons/order.png' : '/assets/icons/comingsoon.png'}`
            }
            alt=""
            priority
          /> */}


          {/* addtocartbutton */}

          {product.variantDetails.available && !outOfStock && (
            <div className={styles.addToCart}>
              <AddToCartButton
                product={{
                  ...product,
                  price:
                    product.variantDetails?.availableBrands?.length > 0
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
