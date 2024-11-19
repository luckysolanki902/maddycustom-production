// components/ProductCard.js
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import styles from './styles/productcard.module.css';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { useMediaQuery } from '@mui/material';
import { useSpring, animated } from '@react-spring/web';
import { useRouter } from 'next/navigation';
import AddToCartButton from '../utils/AddToCartButton';

// import Placeholder from '../ui/Placeholder';

const ProductCard = ({ product, loading }) => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const isSmallDevice = useMediaQuery('(max-width: 600px)');
  const [isZoomed, setIsZoomed] = useState(false);
  const router = useRouter();
  console.log(`${baseImageUrl}${product.variantDetails.available ? '/assets/icons/order.png' : '/assets/icons/comingsoon.png'}`)
  // Define the animation properties using React Spring
  const animationProps = useSpring({
    transform: isZoomed ? 'scale(2) rotate(90deg)' : 'scale(1) rotate(0deg)',
    config: { tension: 300, friction: 20 },
  });

  // Define the overlay properties when zoomed
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

  // Handle Back Button Behavior
  const handlePopState = useCallback(
    (event) => {
      if (isZoomed) {
        // Prevent the default back navigation
        event.preventDefault();
        // Zoom out the image
        setIsZoomed(false);
      }
    },
    [isZoomed]
  );

  useEffect(() => {
    if (isZoomed) {
      // Push a new state to the history when zoomed in
      window.history.pushState({ zoomed: true }, '');

      // Add the popstate event listener
      window.addEventListener('popstate', handlePopState);
    } else {
      // If not zoomed, ensure we don't have extra history entries
      if (window.history.state && window.history.state.zoomed) {
        window.history.back();
      }

      // Remove the popstate event listener
      window.removeEventListener('popstate', handlePopState);
    }

    // Cleanup function
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isZoomed, handlePopState]);

  // Handle navigation to the product page
  const navigateToProductPage = () => {
    if (product.variantDetails.available) {
      router.push(`/shop/${product.pageSlug}`);
    }
    return;
  };

  // if (loading) {
  //   return <Placeholder />
  // }

  return (
    <div
      id={product._id}
      className={styles.mainCardDiv}
      onClick={() => {
        if (!isZoomed) {
          navigateToProductPage();
        }
      }}
      style={{ cursor: isZoomed ? 'default' : 'pointer' }} // Change cursor based on zoom state
    >
      {isSmallDevice && !isZoomed && (
        <div
          className={styles.taptozoom}
          onClick={(e) => {
            e.stopPropagation(); // Prevent the click from bubbling up to the main card
            handleImageClick();
          }}
        >
          <ZoomOutMapIcon
            style={{ marginRight: '1rem', fontSize: '1.1rem', color: 'gray' }}
          />
          <span>Tap to Zoom</span>
        </div>
      )}

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
                unoptimized={product.images && product.images.length > 0 ? false : true}
                className={`${styles.image} ${product?.category?.specificCategoryCode === 'fbw' ? styles.increaseBrightness : ''}`}
                src={
                  product.images && product.images.length > 0
                    ? `${baseImageUrl}${product.images[0]}`
                    : '/images/assets/gifs/helmetloadinggif.gif'
                }
                loop={loading}
                alt={product.name}
                width={1076}
                height={683}
                loading="lazy"
                title={product.title}
                aria-describedby={product.description}
              />
            </animated.div>
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                fontSize: '1rem',
              }}
            >
              {/* Additional content can be added here */}
            </div>
          </div>
        )}
      </animated.div>

      {/* Regular Image with Animation */}
      {!isZoomed && (
        <animated.div
          className={`${styles.image} ${product?.category?.specificCategoryCode === 'fbw' ? styles.increaseBrightness : ''}`}
          style={animationProps}
        // Removed the onClick handler from the image
        >

          <Image
            className={`${styles.image} ${product?.category?.specificCategoryCode === 'fbw' ? styles.increaseBrightness : ''}`}

            src={
              loading
                ? '/images/assets/gifs/helmetloadinggiflandscape2.gif'
                : product.images && product.images.length > 0
                  ? `${baseImageUrl}${product.images[0]}`
                  : '/images/assets/gifs/helmetloadinggiflandscape2.gif'
            }
            alt={product.name}
            width={1076}
            height={683}
            loading="lazy"
            title={product.title}
            aria-describedby={product.description}
          />
        </animated.div>
      )}

      <div className={styles.productDescription}>
        <div className={styles.prodDescRow1}>
          <div className={styles.prodDescRow1} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className={styles.productName}>{product.name}</div>
            <div> <div className={styles.prodDescLastRow}>
              <Image
                width={500}
                height={250}

                src={
                  `${baseImageUrl}${product.variantDetails.available ? '/assets/icons/order.png' : '/assets/icons/comingsoon.png'}`
                }
                alt=""
                priority
              />
            </div></div>
          </div>
          {product.variantDetails.available && <div className={styles.addToCart} >
            <AddToCartButton product={product} />
          </div>}

        </div>
        <div className={styles.prodDescRow2}>
          <div className={styles.productCardSubtitles}>
            {product.variantDetails.cardCaptions?.map((caption, index) => (
              <React.Fragment key={index}>
                <span>{caption}</span> <br />
              </React.Fragment>
            ))}
          </div>

        </div>
        <div className={styles.prodDescRow3}>
          <div className={styles.price}>
            <span className={styles.rupees}>₹</span>
            <span className={styles.actualPrice}>
              {product.variantDetails?.availableBrands?.length > 0
                ? product.variantDetails.availableBrands[0].brandBasePrice + product.price
                : product.price}
            </span>
          </div>

        </div>
        <div className={styles.offer5}>
          <div className={styles.offer5Line1}>
            <span>5%</span>
            <span>off</span>
          </div>
          <div className={styles.offer5Line2}>on every order</div>
          <div className={styles.offer5Line3}>Valid till 30/11/24</div>
        </div>
      </div>

    </div>
  );
};

export default React.memo(ProductCard);

// 'use client';

// import React, { useState, useEffect, useRef } from 'react';
// import styles from './styles/productcard.module.css';
// import { useRouter } from 'next/navigation';
// import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
// import TouchAppIcon from '@mui/icons-material/TouchApp';
// import Zoom from '@mui/material/Zoom';
// import ProductCardWrapper from '@/components/cards/ProductWrapper'; // Import the new component

// const ProductCard = ({ product }) => {
//   const [isZoomed, setIsZoomed] = useState(false);
//   const [showSecondTutorial, setShowSecondTutorial] = useState(false);
//   const [disableLink, setDisableLink] = useState(false);
//   const router = useRouter();
//   const cardRef = useRef(null);

//   const handleClick = () => {
//     setIsZoomed(true);
//     setShowSecondTutorial(true);
//   };

//   const onOtherClick = () => {
//     if (isZoomed) {
//       setIsZoomed(false);
//       setShowSecondTutorial(false);
//       setDisableLink(true);
//       setTimeout(() => {
//         setDisableLink(false);
//       }, 500);
//     }
//   };

//   useEffect(() => {
//     if (isZoomed) {
//       const secondTutorialTimeout = setTimeout(() => {
//         setShowSecondTutorial(false);
//       }, 3000);
//       return () => {
//         clearTimeout(secondTutorialTimeout);
//       };
//     }
//   }, [isZoomed]);

//   const handleLinkClick = () => {
//     if (!disableLink && !isZoomed) {
//       router.push(`/shop/${product.pageSlug}`);
//     }
//   };

//   return (
//     <div className={styles.mainCardDiv} ref={cardRef}>
//       <div className="hideinpc">
//         {!isZoomed && (
//           <div
//             className={styles.taptozoom}
//             style={{
//               marginLeft: '1rem',
//               display: 'flex',
//               alignItems: 'center',
//               fontSize: '0.9rem',
//               color: 'gray',
//               width: '100%',
//               cursor: 'pointer',
//             }}
//             onClick={handleClick}
//           >
//             <ZoomOutMapIcon
//               style={{ marginRight: '1rem', fontSize: '1.1rem', color: 'gray' }}
//             />
//             <span>Tap to Zoom</span>
//           </div>
//         )}
//       </div>
//       <div onClick={handleLinkClick}>
//         <div className={styles.boxShadow}>
//           <div id={product._id}>
//             <Zoom in={true}>
//               <div
//                 className={isZoomed ? `${styles.container} ${styles.zoomed}` : styles.container}
//               >
//                 <div className={styles.imageContainer} onClick={onOtherClick}>
//                   <ProductCardWrapper
//                     product={product}
//                     isZoomed={isZoomed}
//                     onOtherClick={onOtherClick}
//                   />
//                   {showSecondTutorial && isZoomed && (
//                     <div className={`${styles.tutorial} ${styles.rotateSecondTutorial}`}>
//                       Click again to return
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </Zoom>
//           </div>
//           <div>
//             <div>
//               <div className={styles.things}>
//                 <div
//                   style={{
//                     display: 'flex',
//                     alignItems: 'center',
//                     justifyContent: 'center',
//                   }}
//                 >
//                   <span className={styles.productName}>{product.name}</span>
//                 </div>
//               </div>
//               <div className={styles.price}>
//                 <div style={{ marginBottom: '-0.7rem' }}>
//                   <span className={styles.rupees}>₹</span>
//                   <span className={styles.actualPrice}>
//                     {product.price !== undefined ? product.price : ''}
//                   </span>
//                 </div>
//                 <div style={{ marginTop: '1rem' }}>
//                   {product.available ? (
//                     <div className={styles.stockAvailable} style={{ color: '#02a602' }}>
//                       In Stock
//                     </div>
//                   ) : (
//                     <div className={styles.stockUnavailable} style={{ color: '#FB0000' }}>
//                       Out of Stock
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default React.memo(ProductCard);

