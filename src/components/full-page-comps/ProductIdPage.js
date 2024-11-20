// @models/full-page-comps/ProductIdPage.js
"use client";
import styles from './styles/productid.module.css';
import { useState } from 'react';
import ZoomableImage from '../page-sections/product-id-page/ZoomableImage';
import OrderSpecifications from '../page-sections/product-id-page/OrderSpecifications';
import PriceAndChat from '../page-sections/product-id-page/PriceAndChat';
import AddToCartButton from '../utils/AddToCartButton';
import HappyCustomersClient from '../showcase/sliders/HappyCustomerClient';

export default function ProductIdPage({ product, variant, category, description }) {
  const [viewFullDescription, setViewFullDescription] = useState(false);
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
      {!isZoomed && <PriceAndChat price={product.price} />}

      {!isZoomed && <div className={styles.details}>
        <h1 style={{ fontSize: '2rem', margin: '0.5rem 0' }} className={styles.title}>{product.title}</h1>
        {variant?.cardCaptions?.length > 0 && <p>{variant?.cardCaptions[0]}</p>}
        <div className={styles.description}>{viewFullDescription ?
         description :
          description.slice(0, 100)
          }
           <p style={{display:'inline', cursor:'pointer', color:'black'}} onClick={()=> setViewFullDescription(!viewFullDescription)}>{ viewFullDescription? ' view less': '...view more'}</p></div>
      </div>}
      {/* Conditionally render OrderSpecifications based on zoom state */}
      {!isZoomed && (
        <div className={styles.carDiv}>
          <OrderSpecifications features={variant.features} />
        </div>
      )}

      {!isZoomed &&
        <div className={styles.buttonDiv}>
          <AddToCartButton product={{...product, variantDetails: variant, category: category}}
            isLarge={true}
          //  isBlackButton={true}
          />
        </div>}

      {!isZoomed && <HappyCustomersClient  parentSpecificCategoryId={category._id}/>}
    </div>
  );
}
