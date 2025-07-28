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
import { useSpring } from "@react-spring/web";

// Define modern styled buttons with the site's color theme
const PrimaryButton = styled(Button)(({ theme }) => ({
  backgroundColor: "#2d2d2d",
  color: "white",
  fontSize: "1rem",
  fontFamily: "Jost, sans-serif",
  fontWeight: "500",
  textTransform: "none",
  borderRadius: "12px",
  padding: "12px 32px",
  border: "none",
  boxShadow: "0 4px 16px rgba(45, 45, 45, 0.15)",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  "&:hover": {
    backgroundColor: "#1a1a1a",
    boxShadow: "0 6px 24px rgba(45, 45, 45, 0.25)",
    transform: "translateY(-2px)",
  },
  "&:active": {
    transform: "translateY(0)",
    boxShadow: "0 2px 8px rgba(45, 45, 45, 0.2)",
  },
  [theme.breakpoints.down("md")]: {
    fontSize: "0.95rem",
    padding: "10px 28px",
  },
  [theme.breakpoints.down("sm")]: {
    fontSize: "0.9rem",
    padding: "8px 24px",
  },
}));

const SecondaryButton = styled(Button)(({ theme }) => ({
  backgroundColor: "transparent",
  color: "#2d2d2d",
  fontSize: "1rem",
  fontFamily: "Jost, sans-serif",
  fontWeight: "500",
  textTransform: "none",
  borderRadius: "12px",
  padding: "12px 32px",
  border: "2px solid #2d2d2d",
  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  "&:hover": {
    backgroundColor: "#2d2d2d",
    color: "white",
    transform: "translateY(-2px)",
    boxShadow: "0 6px 24px rgba(45, 45, 45, 0.15)",
  },
  "&:active": {
    transform: "translateY(0)",
  },
  [theme.breakpoints.down("md")]: {
    fontSize: "0.95rem",
    padding: "10px 28px",
  },
  [theme.breakpoints.down("sm")]: {
    fontSize: "0.9rem",
    padding: "8px 24px",
  },
}));

export default function ReviewFullComp({
  productId,
  variantId,
  categoryId,
  fetchReviewSource = "variant",
  variant, // e.g. variant name or details if needed
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
        categoryId: categoryId || "",
      });
      const res = await fetch(`/api/reviews/overview?${params.toString()}`);
      const data = await res.json();
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
        categoryId: categoryId || "",
        userPhoneNumber: userPhoneNumber || "",
        page: page.toString(),
        limit: pagination.limit.toString(),
      });

      const res = await fetch(`/api/reviews?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setReviews(data.reviews);
        setPagination(data.pagination);
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
    fetchOverview();
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

  // React Spring: Create a spring animation for scrolling.
  const [spring, api] = useSpring(() => ({ scroll: window.scrollY }));

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#reviews") {
      const reviewElement = document.getElementById("reviews");
      if (reviewElement) {
        const targetY = reviewElement.offsetTop;
        // Animate scroll from current window.scrollY to targetY
        api.start({
          from: { scroll: window.scrollY },
          to: { scroll: targetY },
          config: { tension: 170, friction: 26 },
          onChange: (result) => {
            window.scrollTo(0, result.value.scroll);
          },
        });
      }
    }
    // We only need to run this on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ 
      background: "linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)",
      padding: { xs: "2rem 1rem", sm: "3rem 2rem", md: "4rem 3rem" },
      borderRadius: "24px",
      margin: { xs: "2rem 0", md: "3rem 0" },
      position: "relative",
      overflow: "hidden",
      "&::before": {
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "4px",
        background: "linear-gradient(90deg, #2d2d2d 0%, #4a4a4a 50%, #2d2d2d 100%)",
      }
    }}>
      {/* Header Section */}
      <Box sx={{ 
        textAlign: "center", 
        marginBottom: { xs: "2rem", md: "3rem" },
        position: "relative"
      }}>
        <Typography 
          variant="h3" 
          sx={{
            fontSize: { xs: "1.8rem", sm: "2.2rem", md: "2.5rem" },
            fontWeight: "700",
            color: "#2d2d2d",
            fontFamily: "Jost, sans-serif",
            marginBottom: "0.5rem",
            background: "linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          What Our Customers Say
        </Typography>
        <Typography 
          variant="body1" 
          sx={{
            fontSize: { xs: "1rem", md: "1.1rem" },
            color: "#666",
            fontFamily: "Jost, sans-serif",
            maxWidth: "600px",
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          Real feedback from customers who love our products
        </Typography>
      </Box>

      {/* Ratings Overview Card */}
      <Box sx={{
        backgroundColor: "white",
        borderRadius: "20px",
        padding: { xs: "1.5rem", md: "2rem" },
        marginBottom: { xs: "2rem", md: "3rem" },
        boxShadow: "0 8px 32px rgba(45, 45, 45, 0.08)",
        border: "1px solid rgba(45, 45, 45, 0.05)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: "linear-gradient(90deg, transparent 0%, #2d2d2d 50%, transparent 100%)",
        }
      }}>
        <RatingsOverview
          averageRating={averageRating}
          totalReviews={totalApprovedCount}
          starCounts={starCounts}
          variant={variant}
        />
      </Box>

      {/* Call-to-Action Section */}
      <Box
        id="reviews"
        sx={{
          textAlign: "center",
          margin: { xs: "2.5rem 0", md: "3.5rem 0" },
          padding: { xs: "2rem 1rem", md: "2.5rem 2rem" },
          backgroundColor: "white",
          borderRadius: "20px",
          boxShadow: "0 4px 24px rgba(45, 45, 45, 0.06)",
          border: "1px solid rgba(45, 45, 45, 0.05)",
          position: "relative",
        }}
      >
        <Typography 
          variant="h5" 
          sx={{
            fontSize: { xs: "1.3rem", md: "1.5rem" },
            fontWeight: "600",
            color: "#2d2d2d",
            fontFamily: "Jost, sans-serif",
            marginBottom: "1rem",
          }}
        >
          Share Your Experience
        </Typography>
        <Typography 
          variant="body2" 
          sx={{
            fontSize: { xs: "0.95rem", md: "1rem" },
            color: "#666",
            fontFamily: "Jost, sans-serif",
            marginBottom: "2rem",
            maxWidth: "500px",
            margin: "0 auto 2rem auto",
            lineHeight: 1.5,
          }}
        >
          Help others discover the quality and craftsmanship that makes our products special
        </Typography>
        <PrimaryButton onClick={handleOpenReviewDialog}>
          Write a Review
        </PrimaryButton>
      </Box>

      {/* Customer Photos Section */}
      <Box sx={{
        backgroundColor: "white",
        borderRadius: "20px",
        padding: { xs: "1.5rem", md: "2rem" },
        marginBottom: { xs: "2rem", md: "3rem" },
        boxShadow: "0 8px 32px rgba(45, 45, 45, 0.08)",
        border: "1px solid rgba(45, 45, 45, 0.05)",
      }}>
        <CustomerPhotos
          fetchReviewSource={fetchReviewSource}
          productId={productId}
          variantId={variantId}
          categoryId={categoryId}
          userPhoneNumber={userPhoneNumber}
        />
      </Box>

      {/* Trust Indicators */}
      <Box sx={{ 
        display: "flex", 
        justifyContent: "center", 
        marginBottom: { xs: "2rem", md: "3rem" }
      }}>
        <PaymentShippingPoweredBy />
      </Box>

      {/* Recent Reviews Section */}
      <Box sx={{
        backgroundColor: "white",
        borderRadius: "20px",
        padding: { xs: "1.5rem", md: "2rem" },
        boxShadow: "0 8px 32px rgba(45, 45, 45, 0.08)",
        border: "1px solid rgba(45, 45, 45, 0.05)",
      }}>
        <Typography
          variant="h5"
          sx={{
            fontSize: { xs: "1.3rem", md: "1.5rem" },
            fontWeight: "600",
            color: "#2d2d2d",
            fontFamily: "Jost, sans-serif",
            marginBottom: { xs: "1.5rem", md: "2rem" },
            textAlign: "center",
          }}
        >
          Recent Reviews
        </Typography>

        {/* Loading and Error States */}
        {loading && (
          <Box sx={{ textAlign: "center", padding: "2rem" }}>
            <Typography sx={{ color: "#666", fontFamily: "Jost, sans-serif" }}>
              Loading reviews...
            </Typography>
          </Box>
        )}
        {error && (
          <Box sx={{ textAlign: "center", padding: "2rem" }}>
            <Typography sx={{ color: "#e53e3e", fontFamily: "Jost, sans-serif" }}>
              {error}
            </Typography>
          </Box>
        )}

        {/* Review List */}
        <Box sx={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: { xs: "1rem", md: "1.5rem" } 
        }}>
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
        </Box>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Box sx={{ 
            display: "flex", 
            justifyContent: "center", 
            marginTop: { xs: "2rem", md: "3rem" } 
          }}>
            <Pagination
              count={pagination.totalPages}
              page={pagination.currentPage}
              onChange={handlePageChange}
              sx={{
                "& .MuiPaginationItem-root": {
                  color: "#2d2d2d",
                  fontFamily: "Jost, sans-serif",
                  "&.Mui-selected": {
                    backgroundColor: "#2d2d2d",
                    color: "white",
                  },
                  "&:hover": {
                    backgroundColor: "rgba(45, 45, 45, 0.1)",
                  },
                },
              }}
            />
          </Box>
        )}
      </Box>

      {/* Review Dialog */}
      <ReviewDialog
        open={openReviewDialog}
        onClose={handleCloseReviewDialog}
        productId={productId}
        categoryId={categoryId}
        variantId={variantId}
      />
    </Box>
  );
}
