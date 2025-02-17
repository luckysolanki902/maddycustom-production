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
  width: "auto",
  "&:hover": {
    borderColor: "black",
    color: "black",
  },
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
  variant // e.g. variant name or details if needed
}) {
  // State for the actual reviews
  const [reviews, setReviews] = useState([]);
  // Pagination state
  const [pagination, setPagination] = useState({
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 5,
  });

  // Overview data (overall rating, star distribution, total)
  const [averageRating, setAverageRating] = useState(0);
  const [starCounts, setStarCounts] = useState([]);
  const [totalApprovedCount, setTotalApprovedCount] = useState(0);

  // Other states
  const [openReviewDialog, setOpenReviewDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get user phone from Redux (for example)
  const userPhoneNumber = useSelector(
    (state) => state.orderForm.userDetails.phoneNumber
  );

  /**
   * 1) Fetch Overview
   */
  const fetchOverview = async () => {
    try {
      const params = new URLSearchParams({
        fetchReviewSource,
        productId: productId || "",
        variantId: variantId || "",
      });
      const res = await fetch(`/api/reviews/overview?${params.toString()}`);
      const data = await res.json();
      console.log({starCounts: data.starCounts});
      if (res.ok) {
        setAverageRating(data.averageRating);
        setStarCounts(data.starCounts);
        setTotalApprovedCount(data.totalApprovedCount);
      } else {
        console.error("Error fetching overview:", data.message);
      }
    } catch (error) {
      console.error("Error fetching overview:", error);
    }
  };

  /**
   * 2) Fetch Paginated Reviews
   */
  const fetchReviews = async (page = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        fetchReviewSource,
        productId: productId || "",
        variantId: variantId || "",
        userPhoneNumber: userPhoneNumber || "",
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      const res = await fetch(`/api/reviews?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setReviews(data.reviews);
        setPagination(data.pagination);
        // The route also returns averageRating & starCounts, 
        // but we rely on the separate overview route for final data. 
        // (You can choose to consume it here if you prefer.)
      } else {
        setError(data.message || "Failed to fetch reviews.");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while fetching reviews.");
    } finally {
      setLoading(false);
    }
  };

  // Combined useEffect to get both overview & reviews
  useEffect(() => {
    // fetch overview
    fetchOverview();
    // fetch reviews for page 1
    fetchReviews(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchReviewSource, productId, variantId]);

  // Handle pagination changes
  const handlePageChange = (event, newPage) => {
    fetchReviews(newPage);
  };

  // Handlers for the review dialog
  const handleOpenReviewDialog = () => setOpenReviewDialog(true);
  const handleCloseReviewDialog = () => setOpenReviewDialog(false);

  return (
    <div className={styles.reviewContainer}>
      {/* Title */}
      <Box sx={{ margin: "0.5rem 0 1rem 0" }}>
        <StyledButton sx={{ fontWeight: "600" }} variant="filled">
          Customer Reviews
        </StyledButton>
      </Box>

      {/* Overall Ratings & Star Distribution (from /overview endpoint) */}
      <RatingsOverview
        averageRating={averageRating}
        totalReviews={totalApprovedCount} // real + dummy if enabled
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
        <CustomerPhotos
          fetchReviewSource={fetchReviewSource}
          productId={productId}
          variantId={variantId}
          userPhoneNumber={userPhoneNumber}
        />
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
            date={new Date(review.createdAt).toLocaleDateString()}
          />
        ))}
      </div>

      {/* Pagination (if multiple pages) */}
      {pagination.totalPages > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
          <Pagination
            count={pagination.totalPages}
            page={pagination.currentPage}
            onChange={handlePageChange}
            color="primary"
          />
        </Box>
      )}

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
