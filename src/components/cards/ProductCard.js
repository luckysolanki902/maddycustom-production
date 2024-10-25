'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import styles from './styles/productcard.module.css';
import { useRouter } from 'next/navigation';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import Zoom from '@mui/material/Zoom';

const ProductCard = ({ product }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [showSecondTutorial, setShowSecondTutorial] = useState(false);
  const [disableLink, setDisableLink] = useState(false);
  const router = useRouter();
  const cardRef = useRef(null);

  const handleClick = () => {
    setIsZoomed(true);
    setShowSecondTutorial(true);
  };

  const onOtherClick = () => {
    if (isZoomed) {
      setIsZoomed(false);
      setShowSecondTutorial(false);
      setDisableLink(true);
      setTimeout(() => {
        setDisableLink(false);
      }, 500);
    }
  };

  useEffect(() => {
    if (isZoomed) {
      const secondTutorialTimeout = setTimeout(() => {
        setShowSecondTutorial(false);
      }, 3000);
      return () => {
        clearTimeout(secondTutorialTimeout);
      };
    }
  }, [isZoomed]);

  const handleLinkClick = () => {
    if (!disableLink && !isZoomed) {
      router.push(`/shop/${product.pageSlug}`);
    }
  };

  return (
    <div className={styles.mainCardDiv} ref={cardRef}>
      <div className="hideinpc">
        {!isZoomed && (
          <div
            className={styles.taptozoom}
            style={{
              marginLeft: '1rem',
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.9rem',
              color: 'gray',
              width: '100%',
              cursor: 'pointer',
            }}
            onClick={handleClick}
          >
            <ZoomOutMapIcon
              style={{ marginRight: '1rem', fontSize: '1.1rem', color: 'gray' }}
            />
            <span>Tap to Zoom</span>
          </div>
        )}
      </div>
      <div onClick={handleLinkClick}>
        <div className={styles.boxShadow}>
          <div id={product._id}>
            <Zoom in={true}>
              <div
                className={isZoomed ? styles.container + ' ' + styles.zoomed : styles.container}
              >
                <div className={styles.imageContainer} onClick={onOtherClick}>
                  <div
                    style={{
                      display: 'flex',
                      position: 'relative',
                      minHeight: '220px',
                    }}
                    className={isZoomed ? styles.image + ' ' + styles.rotated2 : styles.image}
                  >
                    {isZoomed && (
                      <div
                        style={{
                          zIndex: '999999',
                          marginBottom: '7rem',
                          marginLeft: '-7rem',
                          backgroundColor: 'white',
                          position: 'absolute',
                          bottom: '0',
                          color: 'black',
                        }}
                        className={styles.rotated3}
                      >
                        <TouchAppIcon style={{ color: 'gray' }} />
                        Tap anywhere to zoom out
                      </div>
                    )}
                    <Image
                      className={isZoomed ? `${styles.image} ${styles.rotated}` : styles.image}
                      src={
                        product.images && product.images.length > 0
                          ? product.images[0]
                          : '/images/placeholder/imagep2.jpg'
                      }
                      alt={product.name}
                      width={1076}
                      height={683}
                      loading="lazy"
                      placeholder="blur"
                      blurDataURL="/images/placeholder/imagep2.jpg"
                      title={product.title}
                      aria-describedby={product.description}
                    />
                  </div>
                  {showSecondTutorial && isZoomed && (
                    <div
                      className={`${styles.tutorial} ${styles.rotateSecondTutorial}`}
                    >
                      Click again to return
                    </div>
                  )}
                </div>
              </div>
            </Zoom>
          </div>
          <div>
            <div>
              <div className={styles.things}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span className={styles.productName}>{product.name}</span>
                </div>
              </div>
              <div className={styles.price}>
                <div style={{ marginBottom: '-0.7rem' }}>
                  <span className={styles.rupees}>₹</span>
                  <span className={styles.actualPrice}>
                    {product.price !== undefined ? product.price : ''}
                  </span>
                </div>
                {/* Discount or offer section can be added here */}
                <div>
                  <div style={{ marginTop: '1rem' }}>
                    {product.available ? (
                      <div
                        className={styles.stockAvailable}
                        style={{ color: '#02a602' }}
                      >
                        In Stock
                      </div>
                    ) : (
                      <div
                        className={styles.stockUnavailable}
                        style={{ color: '#FB0000' }}
                      >
                        Out of Stock
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>  
    </div>
  );
};

export default React.memo(ProductCard);
