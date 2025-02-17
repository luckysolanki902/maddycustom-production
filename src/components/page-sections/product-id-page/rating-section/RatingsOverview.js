"use client";
import React from "react";
import { Box, CircularProgress, Divider, Typography, Skeleton } from "@mui/material";
import { styled, useMediaQuery } from "@mui/system";
import StarDistribution from "./StarDistribution";
import styles from "./styles/RatingsOverview.module.css";

export default function RatingsOverview({
  averageRating = 0,
  totalReviews = 0,
  starCounts = [],
  variant,
  loading, // <-- Accept a loading prop
}) {
  const isSmallDevice = useMediaQuery("(max-width: 600px)");
  const isMediumDevice = useMediaQuery("(max-width: 900px)");
  const progressValue = (averageRating / 5) * 100;

  const CircularContainer = styled(Box)({
    position: "relative",
    display: "inline-flex",
  });

  const TrackProgress = styled(CircularProgress)(({ theme }) => ({
    color: "#dedede",
  }));

  const FilledProgress = styled(CircularProgress)(({ theme }) => ({
    color: "#00C853",
    position: "absolute",
    left: 0,
  }));

  // If still loading, show skeleton placeholders
  if (loading) {
    return (
      <div className={styles.ratingsOverviewContainer}>
        {/* Left half skeleton */}
        <div className={styles.circularSection} style={{ alignItems: "center" }}>
          <Skeleton
            variant="circular"
            width={isSmallDevice ? 90 : isMediumDevice ? 120 : 180}
            height={isSmallDevice ? 90 : isMediumDevice ? 120 : 180}
            sx={{ marginBottom: "8px" }}
          />
          <Skeleton variant="text" width={120} />
        </div>

        {/* Vertical divider placeholder */}
        <Divider
          orientation="vertical"
          flexItem
          sx={{ mx: 2, visibility: "hidden" }} // hide or show as needed
        />

        {/* Right half skeleton */}
        <div className={styles.starDistributionSection}>
          <Box sx={{ width: "100%" }}>
            {/* Skeleton lines for each star row */}
            {[...Array(5)].map((_, idx) => (
              <Skeleton
                key={idx}
                variant="rectangular"
                height={isSmallDevice ? 15 : 20}
                sx={{ my: isSmallDevice ? 1 : 2, borderRadius: "4px", width: '80%' }}
              />
            ))}
          </Box>
        </div>
      </div>
    );
  }

  // If NOT loading, show the actual content
  return (
    <div className={styles.ratingsOverviewContainer}>
      {/* Left (Circular Rating) */}
      <div className={styles.circularSection}>
        <Box
          className={styles.circularWrapper}
          sx={{
            backgroundColor: "#fff",
            padding: "10px",
            borderRadius: "50%",
            boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
          }}
        >
          <CircularContainer>
            <TrackProgress
              variant="determinate"
              value={100}
              size={isSmallDevice ? 90 : isMediumDevice ? 120 : 180}
              thickness={isSmallDevice ? 1.7 : isMediumDevice ? 2.3 : 3.4}
            />
            <FilledProgress
              variant="determinate"
              value={progressValue}
              size={isSmallDevice ? 90 : isMediumDevice ? 120 : 180}
              thickness={isSmallDevice ? 1.7 : isMediumDevice ? 2.3 : 3.4}
              sx={{ color: "#00ec23" }}
            />

            <Box
              sx={{
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                position: "absolute",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div className={styles.circularInnerText}>
                {averageRating.toFixed(2)}
              </div>
            </Box>
          </CircularContainer>
        </Box>
        <div className={styles.basedOnReviews}>
          Based on {totalReviews} reviews
        </div>
      </div>

      {/* Center Divider */}
      <Divider
        orientation="vertical"
        flexItem
        sx={{ mx: 2 }}
        className={styles.verticalDivider}
      />

      {/* Right (Star Distribution) */}
      <div className={styles.starDistributionSection}>
        <StarDistribution
          starCounts={starCounts}
          totalReviews={totalReviews}
          variant={variant}
        />
      </div>
    </div>
  );
}
