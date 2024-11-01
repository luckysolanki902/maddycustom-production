// @models/full-page-comps/ZoomableImage.js
"use client";

import Image from 'next/image';
import CloseIcon from '@mui/icons-material/Close';
import styles from './styles/zoomableimage.module.css';

export default function ZoomableImage({ src, alt, isZoomed, setIsZoomed }) {
  const handleClick = () => {
    setIsZoomed(!isZoomed);
  };

  return (
    <div
      className={`${styles.imgContainer} ${isZoomed ? styles.zoomed : ''}`}
      onClick={handleClick}
    >
      {isZoomed && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '5px',
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
      <Image
        src={src}
        alt={alt}
        width={265 * 6}
        height={342 * 6}
        priority={true}
        className={`${styles.image} ${isZoomed ? styles.rotated : ''}`}
      />
    </div>
  );
}
