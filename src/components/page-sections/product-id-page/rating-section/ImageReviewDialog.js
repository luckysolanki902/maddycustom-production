// src/components/ImageReviewDialog.js
"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Image from 'next/image';
import ReviewCard from './ReviewCard';
import styles from './styles/imageReviewDialog.module.css';

export default function ImageReviewDialog({
  open,
  handleClose,
  initialReview,
  fetchReviewSource = 'product',
  productId,
  variantId,
  categoryId,
  userPhoneNumber,
}) {
  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // We keep a local array of all thumbnails (fetched from /api/reviews/photos)
  const [thumbnails, setThumbnails] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // The currently selected review in the dialog
  const [selectedReview, setSelectedReview] = useState(initialReview);

  // 1) Fetch logic for images
  const fetchPhotos = async (pageNum) => {
    try {
      const params = new URLSearchParams({
        fetchReviewSource,
        productId: productId || '',
        variantId: variantId || '',
        categoryId: categoryId || '',
        userPhoneNumber: userPhoneNumber || '',
        page: pageNum.toString(),
        limit: '5', // or any limit you want for scroller
      });
      const res = await fetch(`/api/reviews/photos?${params}`);
      const data = await res.json();

      if (res.ok) {
        if (pageNum === 1) {
          setThumbnails(data.reviews);
        } else {
          setThumbnails((prev) => [...prev, ...data.reviews]);
        }
        setHasMore(data.hasMore);
      } else {
        console.error('Error fetching photos in dialog:', data.message);
      }
    } catch (err) {
      console.error('Error fetching photos in dialog:', err);
    }
  };

  // 2) On open or relevant prop changes, reset and fetch
  useEffect(() => {
    if (open) {
      setPage(1);
      setThumbnails([]);
    }
  }, [open, productId, variantId, fetchReviewSource, userPhoneNumber]);

  // 3) Actually do the fetch when page changes
  useEffect(() => {
    if (open) {
      fetchPhotos(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, open]);

  // 4) Keep the selected review in state
  useEffect(() => {
    setSelectedReview(initialReview);
  }, [initialReview]);

  // Click on a thumbnail
  const handleThumbnailClick = (review) => {
    setSelectedReview(review);
  };

  // "Load more" for the scroller
  const loadMoreThumbnails = () => {
    if (!hasMore) return;
    setPage((prev) => prev + 1);
  };

  // If user closes the dialog
  if (!selectedReview) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        style: {
          borderRadius: '0.5rem'
        },
      }}
    >
      <DialogContent
        dividers
        sx={{ backgroundColor: 'rgb(0, 0, 0)', padding: 0 }}
      >
        {/* Close Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            className={styles.closeButton}
            sx={{ color: '#fff' }}
          >
            <CloseIcon sx={{ fontSize: 30 }} />
          </IconButton>
        </Box>

        {/* Main Content: Large Image and Review */}
        <Box className={styles.mainContent}>
          <Box className={styles.imageContainer}>
            <Image
              src={`${imageBaseUrl}/${selectedReview.images[0]}`}
              alt={`Review photo by ${selectedReview.name || 'User'}`}
              width={800}
              height={800}
              className={styles.largeImage}
              style={{ borderRadius: '8px' }}
            />
          </Box>
        </Box>

        {/* Thumbnail Scroller */}
        <Box className={styles.thumbnailScroller}>
          {thumbnails.map((r) => (
            <Box
              key={r._id}
              className={`${styles.thumbnail} ${
                r._id === selectedReview._id ? styles.activeThumbnail : ''
              }`}
              onClick={() => handleThumbnailClick(r)}
            >
              <Image
                src={`${imageBaseUrl}/${r.images[0]}`}
                alt={`Thumbnail of review by ${r.name || 'User'}`}
                width={100}
                height={100}
                className={styles.thumbnailImage}
                style={{ borderRadius: '4px' }}
              />
            </Box>
          ))}

          {/* "Load More" tile in scroller */}
          {hasMore && (
            <Box
              onClick={loadMoreThumbnails}
              sx={{
                width: 100,
                height: 100,
                border: '2px dotted #999',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 4px',
                cursor: 'pointer',
              }}
            >
              <Typography sx={{color: 'white', width: 100, height: 100, display: 'flex', justifyContent: 'center', alignItems: 'center'}} variant="body2" color="text.secondary">
                More...
              </Typography>
            </Box>
          )}
        </Box>

        {/* Review Card */}
        <Box className={styles.reviewContainer}>
          <ReviewCard
            rating={selectedReview.rating}
            name={selectedReview.name}
            comment={selectedReview.comment}
            date={new Date(selectedReview.createdAt).toLocaleDateString()}
            fullWidth
          />
        </Box>
      </DialogContent>
    </Dialog>
  );
}
