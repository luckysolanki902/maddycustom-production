"use client";
import styles from './styles/productid.module.css';
import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import OrderSpecifications from '../page-sections/product-id-page/OrderSpecifications';
import PriceAndChat from '../page-sections/product-id-page/PriceAndChat';
// import AddToCartButton from '../utils/AddToCartButton';
import HappyCustomersClient from '../showcase/sliders/HappyCustomerClient';
import { viewContent } from '@/lib/metadata/facebookPixels';
import ContactUs from '../layouts/ContactUs';
import AddToCartButtonWithOrder from '../utils/AddToCartButtonWithOrder';
import ImageGallery from '../page-sections/product-id-page/ImageGallery';
import ReviewFullComp from '../page-sections/product-id-page/ReviewFullComp';


export default function ProductIdPage({ product, variant, category, description }) {
  console.log({productid: product._id});
  const [viewFullDescription, setViewFullDescription] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const userDetails = useSelector((state) => state.orderForm.userDetails);
  const { email, phoneNumber } = userDetails || {};
  const hasTracked = useRef(false);
  const defaultLastImagesForCarousel = variant.defaultCarouselImages?.map((image) => `${imageBaseUrl}${image}`) || [];
  const imagesForProductCarousel = product?.images.map((image) => `${imageBaseUrl}${image}`);
  // Final all images (make sure default Last images are in the last)
  const allImages = [...imagesForProductCarousel, ...defaultLastImagesForCarousel];
  useEffect(() => {
    if (!hasTracked.current) {
      viewContent(product, { email, phoneNumber });
      hasTracked.current = true;
    }
  }, [product, email, phoneNumber]);

  return (
    <>
      <div className={styles.container}>

        <div className={styles.imageGallery}>
        <ImageGallery
          src={`${imageBaseUrl}${product?.images[0]}`}
          images={allImages}
          isZoomed={isZoomed}
          alt={product.title}
          setIsZoomed={setIsZoomed}
          />
          </div>

        {!isZoomed &&
          <div className={styles.productDetails}>


            <div className={styles.details}>
              <h1 className={styles.title}>
                {product.title}
              </h1>
              {variant?.cardCaptions?.length > 0 && <p style={{marginTop:'-0.5rem', marginLeft:'0.3rem'}} className={styles.cardCaption}>{variant?.cardCaptions[0]}</p>}

              {/* <div className={styles.description}>
                {viewFullDescription ? description : description.slice(0, 100)}
                <p
                  style={{ display: 'inline', cursor: 'pointer', color: 'black' }}
                  onClick={() => setViewFullDescription(!viewFullDescription)}
                >
                  {viewFullDescription ? ' view less' : '...view more'}
                </p>
              </div> */}

            </div>

            <PriceAndChat price={variant?.availableBrands?.length > 0
            ? variant.availableBrands[0].brandBasePrice + product.price
              : product.price} />


            <div className={styles.orderSpecificationsContainer}>
              <OrderSpecifications features={variant.features} justContStart={true}/>
            </div>

            <div className={styles.buttonDiv}>
              <AddToCartButtonWithOrder
                product={{
                  ...product, variantDetails: variant, category: category, price:
                    variant?.availableBrands?.length > 0
                      ? variant.availableBrands[0].brandBasePrice + product.price
                      : product.price,
                }}
                isLarge={true}
              />
            </div>
          </div>
        }



      </div>

      <ReviewFullComp productId={product._id}/>

        {/* <HappyCustomersClient parentSpecificCategoryId={category._id} /> */}
        
        <ContactUs />
    </>
  );
}
