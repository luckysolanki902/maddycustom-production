// src/components/ReviewFullComp.js

"use client";

import React from "react";
import styles from "./styles/ReviewFullComp.module.css";
import { constReviews } from "./constReviews";

import { Box, Button, Typography, styled } from "@mui/material";
import RatingsOverview from "./rating-section/RatingsOverview";
import CustomerPhotos from "./rating-section/CustomerPhotos";
import ReviewCard from "./rating-section/ReviewCard";
import PaymentShippingPoweredBy from "./rating-section/PaymentShippingPoweredBy";

// Define a reusable styled MUI Button with responsive styles
const StyledButton = styled(Button)(({ theme }) => ({
  borderColor: "black",
  boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.1)",
  fontSize: "1.1rem",
  fontFamily: "Jost",
  textTransform: "none",
  borderWidth: 2,
  padding: "0.5rem 4rem",
  color: "black",
  transition: "all 0.3s ease-in-out",
  width: "auto", // Auto width on desktop

  "&:hover": {
    borderColor: "black",
    color: "black",
  },

  "&:active": {
    borderColor: "black",
    color: "black",
  },

  // Responsive Styles
  [theme.breakpoints.down("md")]: {
    fontSize: "1rem",
    padding: "0.4rem 3rem",
  },

  [theme.breakpoints.down("sm")]: {
    fontSize: "0.9rem",
    padding: "0.3rem 2rem",
  },
}));

export default function ReviewFullComp() {
  const totalReviews = constReviews.length;
  const averageRating =
    constReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;

  const starCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: constReviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className={styles.reviewContainer}>
      {/* Customer Reviews Button */}
      <Box sx={{ margin: '0.5rem 0 1rem 0' }}>
        <StyledButton sx={{ fontWeight: '600' }} variant="filled">Customer Reviews</StyledButton>
      </Box>

      {/* Overall Ratings & Star Distribution */}
      <RatingsOverview
        averageRating={averageRating}
        totalReviews={totalReviews}
        starCounts={starCounts}
      />

      {/* Write a Review Button */}
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          margin: "3rem 0",

          "@media (max-width: 768px)": {
            margin: "2rem 0",
          },

          "@media (max-width: 480px)": {
            margin: "1.5rem 0",
          },
        }}
      >
        <StyledButton variant="outlined">Write a review</StyledButton>
      </Box>

      {/* Review Photos */}
      <div className={styles.reviewPhotosSection}>
        <CustomerPhotos />
      </div>

      {/* Payment and shipping by label */}
      <Box sx={{ width:'100%', display:'flex', justifyContent:'center'}}>
      <PaymentShippingPoweredBy />

      </Box>

      {/* Most Recent Reviews */}
      <Typography
        variant="h5"
        sx={{
          fontSize: "1.3rem",
          fontWeight: "700",
          textAlign: "left",
          margin: "2rem 0 1rem 0.5rem",

          "@media (max-width: 768px)": {
            fontSize: "1.2rem",
            fontWeight: '600'
          },

          "@media (max-width: 480px)": {
            fontSize: "1rem",
          },
        }}
      >
        Most Recent
      </Typography>

      {/* Review List */}
      <div className={styles.reviewList}>
        {constReviews.map((review) => (
          <ReviewCard
            key={review.id}
            rating={review.rating}
            name={review.name}
            comment={review.comment}
            date={review.date}
          />
        ))}
      </div>
    </div>
  );
}
