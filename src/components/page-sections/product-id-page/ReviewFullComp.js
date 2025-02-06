// src/components/ReviewFullComp.js
"use client";

import React, { useState, useEffect } from "react";
import styles from "./styles/ReviewFullComp.module.css";
import {
  Box,
  Button,
  Typography,
  styled,
  Pagination,
} from "@mui/material";
import RatingsOverview from "./rating-section/RatingsOverview";
import CustomerPhotos from "./rating-section/CustomerPhotos";
import ReviewCard from "./rating-section/ReviewCard";
import PaymentShippingPoweredBy from "./rating-section/PaymentShippingPoweredBy";
import ReviewDialog from "./rating-section/ReviewDialog";
import { useSelector } from "react-redux";

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

export default function ReviewFullComp({
  productId,
  variantId,
  categoryId,
  fetchReviewSource = "variant",
  variant // default to 'variant'
}) {
  const [reviews, setReviews] = useState([]);
  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const userPhoneNumber = useSelector(
    (state) => state.orderForm.userDetails.phoneNumber
  );
  

  const [pagination, setPagination] = useState({
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 5,
  });
  // New state variables to store overall rating and star counts from the API.
  const [averageRating, setAverageRating] = useState(0);
  const [starCounts, setStarCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State to hold variant details (including tempReviewCount)
  const [variantDetails, setVariantDetails] = useState(null);

  // Fetch reviews from the API
  const fetchReviews = async (page = 1) => {
    setLoading(true);
    try {
      // Build query parameters for the API
      const params = new URLSearchParams({
        fetchReviewSource,
        productId: productId || "",
        variantId: variantId || "",
        userPhoneNumber,
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
      const res = await fetch(`/api/reviews?${params.toString()}`);
      const data = await res.json();
      console.log(data)
      if (res.ok) {
        setReviews(data.reviews);
        setPagination(data.pagination);
        // Set the overall average rating and star counts computed in the backend
        setAverageRating(data.averageRating);
        setStarCounts(data.starCounts);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while fetching reviews.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch variant details to get tempReviewCount
  const fetchVariantDetails = async () => {
    if (!variantId) return;
    try {
      const res = await fetch(`/api/get-variant?variantId=${variantId}`);
      const data = await res.json();
      if (res.ok) {
        setVariantDetails(data);
      } else {
        console.error("Failed to fetch variant details:", data.error);
      }
    } catch (err) {
      console.error("Error fetching variant details:", err);
    }
  };

  const handleOpenReviewDialog = () => setOpenReviewDialog(true);
  const handleCloseReviewDialog = () => setOpenReviewDialog(false);

  // Initial fetch or when dependencies change
  useEffect(() => {
    fetchReviews(pagination.currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, variantId, fetchReviewSource]);

  // Fetch variant details when variantId is available or changes
  useEffect(() => {
    fetchVariantDetails();
  }, [variantId]);

  // Handle page change from the MUI Pagination component
  const handlePageChange = (event, value) => {
    fetchReviews(value);
  };

  const fetchtempreview = (variantDetails !== null)?(variantDetails.tempReviewCount):0

  // Calculate summary information based on fetched reviews
  const totalReviews = reviews.length;
  // const averageRating =
  //   totalReviews > 0
  //     ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
  //     : 0;
  // const starCounts = [5, 4, 3, 2, 1].map((star) => ({
  //   star,

  //   count: reviews.length>0 && reviews.filter((r) => r.rating === star).length,
  // }));

  return (
    <div className={styles.reviewContainer}>
      {/* Customer Reviews Button */}
      <Box sx={{ margin: "0.5rem 0 1rem 0" }}>
        <StyledButton sx={{ fontWeight: "600" }} variant="filled">
          Customer Reviews
        </StyledButton>
      </Box>


    {/* Overall Ratings & Star Distribution */}
      <RatingsOverview
        averageRating={averageRating}

        totalReviews={pagination.totalCount+fetchtempreview}
        starCounts={starCounts}
        variant={variant}
      />

      {/* Write a Review Button */}
      <Box
        sx={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          margin: "3rem 0",
          "@media (max-width: 768px)": { margin: "2rem 0" },
          "@media (max-width: 480px)": { margin: "1.5rem 0" },
        }}
      >
        <StyledButton variant="outlined" onClick={handleOpenReviewDialog}>
          Write a review
        </StyledButton>
      </Box>

      {/* Customer Photos Section */}
      <div className={styles.reviewPhotosSection}>
        <CustomerPhotos reviews={reviews} />
      </div>

      {/* Payment and shipping by label */}
      <Box sx={{ width: "100%", display: "flex", justifyContent: "center" }}>
        <PaymentShippingPoweredBy />
      </Box>

      {/* Most Recent Reviews Heading */}
      <Typography
        variant="h5"
        sx={{
          fontSize: "1.3rem",
          fontWeight: "700",
          textAlign: "left",
          margin: "2rem 0 1rem 0.5rem",
          "@media (max-width: 768px)": { fontSize: "1.2rem", fontWeight: "600" },
          "@media (max-width: 480px)": { fontSize: "1rem" },
        }}
      >
        Most Recent
      </Typography>

      {/* Loading and Error States */}
      {loading && <Typography>Loading reviews...</Typography>}
      {error && <Typography color="error">{error}</Typography>}

      {/* Review List */}
      <div className={styles.reviewList}>
        {reviews.map((review) => (
          <ReviewCard
            key={review._id}
            rating={review.rating}
            name={review.name}
            comment={review.comment}
            status={review.status}
            // Use createdAt from MongoDB for the review date
            date={new Date(review.createdAt).toLocaleDateString()}
          />
        ))}
        {/* Display tempReviewCount at the bottom of the page */}
      
      </div>

      {/* MUI Pagination UI (if applicable) */}
      {/* Uncomment this block if you wish to display pagination */}
      {/* {pagination.totalPages > 1 && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            marginTop: "1rem",
          }}
        >
          <Pagination
            count={pagination.totalPages}
            page={pagination.currentPage}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )} */}

      {/* Review Dialog */}
      <ReviewDialog
        open={openReviewDialog}
        onClose={handleCloseReviewDialog}
        productId={productId}
        categoryId={categoryId}
        variantId={variantId}
      />

      
    </div>
  );
}
