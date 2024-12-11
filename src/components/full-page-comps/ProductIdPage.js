"use client";
import styles from './styles/productid.module.css';
import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import ZoomableImage from '../page-sections/product-id-page/ZoomableImage';
import OrderSpecifications from '../page-sections/product-id-page/OrderSpecifications';
import PriceAndChat from '../page-sections/product-id-page/PriceAndChat';
import AddToCartButton from '../utils/AddToCartButton';
import HappyCustomersClient from '../showcase/sliders/HappyCustomerClient';
import { viewContent } from '@/lib/metadata/facebookPixels';
import ContactUs from '../layouts/ContactUs';

export default function ProductIdPage({ product, variant, category, description }) {
  const [viewFullDescription, setViewFullDescription] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const userDetails = useSelector((state) => state.orderForm.userDetails);
  const { email, phoneNumber } = userDetails || {};
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!hasTracked.current) {
      viewContent(product, { email, phoneNumber });
      hasTracked.current = true;
    }
  }, [product, email, phoneNumber]);

  return (
    <>
    <div className={styles.container}>
      <ZoomableImage
        src={`${imageBaseUrl}${product?.images[0]}`}
        alt="product image"
        isZoomed={isZoomed}
        setIsZoomed={setIsZoomed}
      />
      {!isZoomed && <PriceAndChat price={product.price} />}
      {!isZoomed && (
        <div className={styles.details}>
          <h1 style={{ fontSize: '2rem', margin: '0.5rem 0' }} className={styles.title}>
            {product.title}
          </h1>
          {variant?.cardCaptions?.length > 0 && <p>{variant?.cardCaptions[0]}</p>}
          <div className={styles.description}>
            {viewFullDescription ? description : description.slice(0, 100)}
            <p
              style={{ display: 'inline', cursor: 'pointer', color: 'black' }}
              onClick={() => setViewFullDescription(!viewFullDescription)}
              >
              {viewFullDescription ? ' view less' : '...view more'}
            </p>
          </div>
        </div>
      )}
      {!isZoomed && (
        <div className={styles.carDiv}>
          <OrderSpecifications features={variant.features} />
        </div>
      )}
      {!isZoomed && (
        <div className={styles.buttonDiv}>
          <AddToCartButton
            product={{ ...product, variantDetails: variant, category: category }}
            isLarge={true}
          />
        </div>
      )}
    </div>
      {!isZoomed && <HappyCustomersClient parentSpecificCategoryId={category._id} />}
      {!isZoomed && <ContactUs />}
      </>
  );
}
