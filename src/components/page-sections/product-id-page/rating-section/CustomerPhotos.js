// src/components/CustomerPhotos.js
"use client";

import React, { useEffect, useState } from 'react';
import { Typography, Box, Grid, Paper, Skeleton } from '@mui/material';
import Image from 'next/image';
import ImageReviewDialog from './ImageReviewDialog';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';

export default function CustomerPhotos({
  fetchReviewSource = 'product',
  productId,
  variantId,
  categoryId,
  userPhoneNumber,
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
        categoryId: categoryId || '',
        userPhoneNumber: userPhoneNumber || '',
        page: pageNumber.toString(),
        limit: limit.toString(),
      });
      const res = await fetch(`/api/reviews/photos?${params.toString()}`);
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
    setCurrentPage(1);
    setPhotos([]);
  }, [productId, variantId, categoryId, fetchReviewSource, userPhoneNumber]);

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

  const photosWithImages = photos.filter((r) => r.images && r.images.length > 0);

  return (
    <Box sx={{ width: "100%" }}>
      {/* Header */}
      <Box sx={{ 
        display: "flex", 
        alignItems: "center", 
        gap: 1.5,
        marginBottom: { xs: 2, md: 3 },
        justifyContent: "center"
      }}>
        <PhotoLibraryIcon sx={{ 
          fontSize: "1.5rem", 
          color: "#2d2d2d" 
        }} />
        <Typography sx={{
          fontSize: { xs: "1.3rem", md: "1.5rem" },
          fontWeight: "600",
          color: "#2d2d2d",
          fontFamily: "Jost, sans-serif",
          textAlign: "center"
        }}>
          Customer Photos
        </Typography>
      </Box>

      {/* Loading State */}
      {loading && photosWithImages.length === 0 && (
        <Grid container spacing={2}>
          {[...Array(6)].map((_, index) => (
            <Grid item xs={6} sm={4} md={2} key={index}>
              <Skeleton
                variant="rectangular"
                sx={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: "12px"
                }}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* No Photos State */}
      {photosWithImages.length === 0 && !loading && (
        <Box sx={{
          textAlign: "center",
          padding: { xs: "2rem", md: "3rem" },
          backgroundColor: "#f8f9fa",
          borderRadius: "16px",
          border: "2px dashed rgba(45, 45, 45, 0.1)"
        }}>
          <PhotoLibraryIcon sx={{ 
            fontSize: "3rem", 
            color: "rgba(45, 45, 45, 0.3)",
            marginBottom: 1
          }} />
          <Typography sx={{
            fontSize: "1.1rem",
            color: "#666",
            fontFamily: "Jost, sans-serif",
            fontWeight: "500"
          }}>
            No customer photos yet
          </Typography>
          <Typography sx={{
            fontSize: "0.9rem",
            color: "#999",
            fontFamily: "Jost, sans-serif",
            marginTop: 0.5
          }}>
            Be the first to share a photo with your review!
          </Typography>
        </Box>
      )}

      {/* Photo Grid */}
      {photosWithImages.length > 0 && (
        <Grid container spacing={2}>
          {photosWithImages.slice(0, 10).map((review, index) => (
            <Grid item xs={6} sm={4} md={2} key={review._id}>
              <Paper
                sx={{
                  position: "relative",
                  aspectRatio: "1",
                  borderRadius: "12px",
                  overflow: "hidden",
                  cursor: "pointer",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  border: "1px solid rgba(45, 45, 45, 0.08)",
                  "&:hover": {
                    transform: "scale(1.05)",
                    boxShadow: "0 8px 32px rgba(45, 45, 45, 0.15)",
                    borderColor: "#2d2d2d",
                  }
                }}
                onClick={() => handleImageClick(review)}
              >
                <Image
                  fill
                  src={`${imageBaseUrl}/${review.images[0]}`}
                  alt={`Review photo by ${review.name || 'Customer'}`}
                  style={{ 
                    objectFit: "cover",
                  }}
                  sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 20vw"
                />
                {/* Overlay with review info */}
                <Box sx={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                  padding: "0.5rem",
                  color: "white",
                  fontSize: "0.75rem",
                  fontFamily: "Jost, sans-serif",
                  opacity: 0,
                  transition: "opacity 0.3s ease",
                  ".MuiPaper-root:hover &": {
                    opacity: 1
                  }
                }}>
                  <Typography sx={{
                    fontSize: "0.75rem",
                    fontWeight: "500",
                    color: "white",
                    fontFamily: "Jost, sans-serif"
                  }}>
                    by {review.name}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog */}
      {currentReview && (
        <ImageReviewDialog
          open={dialogOpen}
          handleClose={handleCloseDialog}
          initialReview={currentReview}
          fetchReviewSource={fetchReviewSource}
          productId={productId}
          variantId={variantId}
          categoryId={categoryId}
          userPhoneNumber={userPhoneNumber}
        />
      )}
    </Box>
  );
}
