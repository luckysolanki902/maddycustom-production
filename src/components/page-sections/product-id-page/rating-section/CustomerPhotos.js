// src/components/CustomerPhotos.js
"use client";

import React, { useEffect, useState } from 'react';
import styles from './styles/customerphotos.module.css';
import { Typography, Box } from '@mui/material';
import Image from 'next/image';
import ImageReviewDialog from './ImageReviewDialog';

export default function CustomerPhotos({
  fetchReviewSource = 'product', // or 'variant'
  productId,
  variantId,
  userPhoneNumber, // optional
  limit = 5,
}) {
  const [photos, setPhotos] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentReview, setCurrentReview] = useState(null);

  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  const fetchPhotos = async (pageNumber) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        fetchReviewSource,
        productId: productId || '',
        variantId: variantId || '',
        userPhoneNumber: userPhoneNumber || '',
        page: pageNumber.toString(),
        limit: limit.toString(),
      });
      const res = await fetch(`/api/reviews/photos?${params}`);
      const data = await res.json();

      if (res.ok) {
        if (pageNumber === 1) {
          setPhotos(data.reviews);
        } else {
          setPhotos((prev) => [...prev, ...data.reviews]);
        }
        setHasMore(data.hasMore);
      } else {
        console.error('Error fetching photos:', data.message);
      }
    } catch (err) {
      console.error('Error fetching photos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // reset to page=1 on prop changes
    setCurrentPage(1);
    setPhotos([]);
  }, [productId, variantId, fetchReviewSource, userPhoneNumber]);

  useEffect(() => {
    fetchPhotos(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handleImageClick = (review) => {
    setCurrentReview(review);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCurrentReview(null);
  };

  const loadMore = () => {
    if (!hasMore) return;
    setCurrentPage((prev) => prev + 1);
  };

  const photosWithImages = photos.filter((r) => r.images && r.images.length > 0);

  return (
    <div className={styles.mainContainer}>
      <div className={styles.container}>
        <h3 className={styles.mainHeading}>Customer Photos</h3>
        {photosWithImages.length === 0 && !loading ? (
          <Typography
            variant="body1"
            color="textSecondary"
            align="center"
            gutterBottom
          >
            No photos yet
          </Typography>
        ) : (
          <div className={styles.imageGrid}>
            {photosWithImages.slice(0, 10).map((review) => (
              <div
                key={review._id}
                className={styles.reviewImageContainer}
                onClick={() => handleImageClick(review)}
              >
                <Image
                  width={200}
                  height={200}
                  className={styles.reviewImage}
                  src={`${imageBaseUrl}/${review.images[0]}`}
                  alt={`Review photo by ${review.name || 'User'}`}
                  style={{ borderRadius: '8px' }}
                  objectFit="cover"
                />
              </div>
            ))}

            {/* "Load More" dotted card if we have more */}
            {/* {hasMore && (
              <Box
                onClick={loadMore}
                sx={{
                  width: 200,
                  height: 200,
                  border: '2px dotted #999',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  borderRadius: '8px',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {loading ? 'Loading...' : 'Load More'}
                </Typography>
              </Box>
            )} */}
          </div>
        )}
      </div>

      {currentReview && (
        <ImageReviewDialog
          open={dialogOpen}
          handleClose={handleCloseDialog}
          initialReview={currentReview}
          fetchReviewSource={fetchReviewSource}
          productId={productId}
          variantId={variantId}
          userPhoneNumber={userPhoneNumber}
        />
      )}
    </div>
  );
}
