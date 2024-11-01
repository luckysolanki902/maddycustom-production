// @models/full-page-comps/ProductIdPage.js
"use client";
import styles from './styles/productid.module.css';
import { useState } from 'react';
import ZoomableImage from '../page-sections/product-id-page/ZoomableImage';
import OrderSpecifications from '../page-sections/product-id-page/OrderSpecifications';
import PriceAndChat from '../page-sections/product-id-page/PriceAndChat';
import HappyCustomers from '../showcase/sliders/HappyCustomers';

export default function ProductIdPage({ product, variant }) {
  const [isZoomed, setIsZoomed] = useState(false);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  return (
    <div className={styles.container}>
      <ZoomableImage
        src={`${imageBaseUrl}${product?.images[0]}`}
        alt="product image"

        isZoomed={isZoomed}
        setIsZoomed={setIsZoomed}
      />
      {!isZoomed && <div style={{ textAlign: 'center', margin: '2rem 0' }}>
        <h1 style={{ fontSize: '2rem', margin: '0.5rem 0' }}>{product.title}</h1>
        <p style={{ fontSize: '1.2rem', margin: '0.5rem auto', maxWidth:'900px' }}>{product.description}</p>
      </div>}
      {/* Conditionally render OrderSpecifications based on zoom state */}
      {!isZoomed && (
        <div className={styles.carDiv}>
          <OrderSpecifications features={variant.features} />
        </div>
      )}

      {!isZoomed && <PriceAndChat price={product.price} />}
      {!isZoomed && <HappyCustomers parentSpecificCategory={variant.parentSpecificCategory} />}
    </div>
  );
}
