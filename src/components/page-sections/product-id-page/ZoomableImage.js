// @models/full-page-comps/ZoomableImage.js
"use client";

import Image from 'next/image';
import CloseIcon from '@mui/icons-material/Close';
import styles from './styles/zoomableimage.module.css';
import { useSpring, animated } from '@react-spring/web';
import { useCallback, useEffect } from 'react';
import { useMediaQuery } from '@mui/material';


export default function ZoomableImage({ src, alt, isZoomed, setIsZoomed }) {
  const handleClick = () => {
    setIsZoomed(!isZoomed);
  };
  const isSmallDevice = useMediaQuery('(max-width: 600px)');


  // Define the animation properties using React Spring
  const animationProps = useSpring({
    transform: isZoomed ? 'scale(1) rotate(90deg)' : 'scale(1) rotate(0deg)',
    config: { tension: 300, friction: 20 },
  });

  // Handle Back Button Behavior
  const handlePopState = useCallback(
    (event) => {
      if (isZoomed) {
        // Prevent the default back navigation
        event.preventDefault();
        // Zoom out the image
        handleClick();
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


  return (
    <div
      className={`${styles.imgContainer} ${isZoomed ? styles.zoomed : ''}`}
      onClick={handleClick}
    >
      {isZoomed && !isSmallDevice && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            cursor: 'pointer',
            zIndex: '99999',
            backgroundColor: 'white',
            borderRadius: '50%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <CloseIcon onClick={() => setIsZoomed(false)} style={{ fontSize: '2rem', color: '#000', zIndex: '99999' }} />
        </div>
      )}
      <animated.div className={styles.animatedDiv} style={isSmallDevice ? animationProps: {}}>
      <Image
        src={src}
        alt={alt}
        width={265 * 6}
        height={342 * 6}
        priority={true}
        className={`${styles.image} ${isZoomed ? styles.rotated : ''}`}
      />
    </animated.div>
    </div>
  );
}
