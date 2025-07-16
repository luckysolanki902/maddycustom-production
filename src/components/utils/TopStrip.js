'use client';

import React from 'react';
import Image from 'next/image';

/**
 * TopStrip Component - Flexible strip for displaying offers or info above topbar
 * 
 * @param {Object} props
 * @param {string} [props.text] - Text content to display (for text mode)
 * @param {Object} [props.images] - Images object with pc and phone properties (for image mode)
 * @param {string} [props.images.pc] - Desktop image filename
 * @param {string} [props.images.phone] - Mobile image filename
 * @param {string} [props.backgroundColor] - Background color for text mode
 * @param {string} [props.textColor] - Text color for text mode
 * @param {string} [props.fontSize] - Font size for text mode
 * @param {string} [props.padding] - Padding for text mode
 * @param {React.CSSProperties} [props.style] - Additional custom styles
 * @param {function} [props.onClick] - Click handler
 */
const TopStrip = ({
  text,
  images,
  backgroundColor = '#000',
  textColor = '#fff',
  fontSize = '14px',
  padding = '8px 16px',
  style = {},
  onClick,
}) => {
  const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // Image mode
  if (images && images.pc && images.phone) {
    return (
      <div
        style={{
          width: '100%',
          height: 'auto',
          position: 'relative',
          cursor: onClick ? 'pointer' : 'default',
          ...style,
        }}
        onClick={onClick}
      >
        {/* Desktop Image */}
        <div
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
          }}
          className="hidden-mobile"
        >
          <Image
            src={`${baseUrl}/assets/posters/${images.pc}`}
            alt="Top Strip Banner"
            width={1920}
            height={100}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
            priority
          />
        </div>

        {/* Mobile Image */}
        <div
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
          }}
          className="hidden-desktop"
        >
          <Image
            src={`${baseUrl}/assets/posters/${images.phone}`}
            alt="Top Strip Banner Mobile"
            width={768}
            height={100}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
            priority
          />
        </div>

        <style jsx>{`
          @media (max-width: 768px) {
            .hidden-mobile {
              display: none !important;
            }
          }
          @media (min-width: 769px) {
            .hidden-desktop {
              display: none !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // Text mode
  if (text) {
    return (
      <div
        style={{
          width: '100%',
          backgroundColor,
          color: textColor,
          fontSize,
          padding,
          textAlign: 'center',
          cursor: onClick ? 'pointer' : 'default',
          ...style,
        }}
        onClick={onClick}
      >
        {text}
      </div>
    );
  }

  // Return null if neither text nor images provided
  return null;
};

export default TopStrip;
