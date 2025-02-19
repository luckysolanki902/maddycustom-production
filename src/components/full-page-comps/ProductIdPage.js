"use client";

import styles from './styles/productid.module.css';
import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import OrderSpecifications from '../page-sections/product-id-page/OrderSpecifications';
import PriceAndChat from '../page-sections/product-id-page/PriceAndChat';
import HappyCustomersClient from '../showcase/sliders/HappyCustomerClient';
import { viewContent } from '@/lib/metadata/facebookPixels';
import ContactUs from '../layouts/ContactUs';
import AddToCartButtonWithOrder from '../utils/AddToCartButtonWithOrder';
import ImageGallery from '../page-sections/product-id-page/ImageGallery';
import ReviewFullComp from '../page-sections/product-id-page/ReviewFullComp';
import ProductDescription from '../page-sections/product-id-page/ProductInfoTab';
import { TopBoughtProducts } from '../showcase/products/TopBoughtProducts';
import Footer from '../layouts/Footer';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import useMediaQuery from '@mui/material/useMediaQuery';

export default function ProductIdPage({ product, variant, category, description }) {
  const [viewFullDescription, setViewFullDescription] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [soldCount, setSoldCount] = useState(null);
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  const userDetails = useSelector((state) => state.orderForm.userDetails);
  const { email, phoneNumber } = userDetails || {};
  const hasTracked = useRef(false);

  // Media queries for different breakpoints
  const isLessThan1000 = useMediaQuery('(max-width: 999px)');
  const isBetween1000And1400 = useMediaQuery('(min-width: 1000px) and (max-width: 1399px)');
  const isGreaterThan1400 = useMediaQuery('(min-width: 1400px)');

  const defaultLastImagesForCarousel =
    variant.defaultCarouselImages?.map((image) =>
      `${imageBaseUrl}${image.startsWith('/') ? image : '/' + image}`
    ) || [];

  const imagesForProductCarousel = product?.images.map((image) =>
    `${imageBaseUrl}${image.startsWith('/') ? image : '/' + image}`
  );

  // Combine images, ensuring default last images appear at the end.
  const allImages = [...imagesForProductCarousel, ...defaultLastImagesForCarousel];

  useEffect(() => {
    if (!hasTracked.current) {
      viewContent(product, { email, phoneNumber });
      hasTracked.current = true;
    }
  }, [product, email, phoneNumber]);

  // Fetch the sold count from the API route.
  useEffect(() => {
    async function fetchSoldCount() {
      try {
        // Here we're using the category's _id and asking for a rounded value.
        const response = await fetch(
          `/api/stats/sales?type=specificCategory&id=${category._id}&days=10&round=true`
        );
        const data = await response.json();
        setSoldCount(data.totalItemsSold);
      } catch (error) {
        console.error('Error fetching sold count:', error);
      }
    }
    if (category && category._id) {
      fetchSoldCount();
    }
  }, [category]);

  // A reusable element for "Sold by Category"
  const soldByCategoryEl = (
    <div className={styles.soldByCategory}>
      <TrendingUpIcon sx={{ color: 'green', marginRight: '5px' }} />
      {soldCount !== null
        ? soldCount < 20 ? '20+' : `${soldCount}+`
        : 'Loading sold count...'}
    </div>
  );

  return (
    <div
     style={{paddingBottom: '6rem'}}
    >
      <div className={styles.container}>
        <div className={styles.imageGallery}>
          <ImageGallery
            src={`${imageBaseUrl}${
              product?.images[0]?.startsWith('/')
                ? product.images[0]
                : '/' + product.images[0]
            }`}
            images={allImages}
            isZoomed={isZoomed}
            alt={product.title}
            setIsZoomed={setIsZoomed}
          />
          {/* For devices between 1000px and 1400px, show the sold count here */}
          {isBetween1000And1400 && soldByCategoryEl}
        </div>

        {!isZoomed && (
          <div className={styles.productDetails}>
            <div className={styles.details}>
              <h1 className={styles.title}>{product.title}</h1>
              {variant?.cardCaptions?.length > 0 && (
                <p
                  style={{ marginTop: '-0.5rem', marginLeft: '0.3rem' }}
                  className={styles.cardCaption}
                >
                  {variant?.cardCaptions[0]}
                </p>
              )}
            </div>

            <PriceAndChat
              price={
                variant?.availableBrands?.length > 0
                  ? variant.availableBrands[0].brandBasePrice + product.price
                  : product.price
              }
            />


            <div className={styles.orderSpecificationsContainer}>
              <OrderSpecifications features={variant.features} justContStart={true} />
            </div>

            <div className={styles.buttonDiv}>
              <AddToCartButtonWithOrder
                product={{
                  ...product,
                  variantDetails: variant,
                  category: category,
                  price:
                    variant?.availableBrands?.length > 0
                      ? variant.availableBrands[0].brandBasePrice + product.price
                      : product.price,
                }}
                isLarge={true}
              />
            </div>

            {/* For devices greater than 1400px, show the sold count here */}
            {isGreaterThan1400 && soldByCategoryEl}
            
            {/* For devices less than 1000px, show the sold count here */}
            {isLessThan1000 && soldByCategoryEl}
          </div>
        )}
      </div>

      <ProductDescription
        imageUrl={`${imageBaseUrl}${
          product?.images[0]?.startsWith('/')
            ? product.images[0]
            : '/' + product.images[0]
        }`}
        productId={product._id}
        variantId={variant._id}
        selectedCategory={category}
      />

      {/* Showcase */}
      <TopBoughtProducts
        subCategories={[category?.subCategory]}
        excludeProductIds={[product?._id]}
      />

      <ReviewFullComp
        productId={product._id}
        variantId={variant._id}
        categoryId={category._id}
        fetchReviewSource={category.reviewFetchSource}
        variant={variant}
      />

      {/* <Footer /> */}
    </div>
  );
}
