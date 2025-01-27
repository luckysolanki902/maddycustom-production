import React from "react";
import { Box, CircularProgress, Divider, Typography } from "@mui/material";
import { styled } from "@mui/system";
import StarDistribution from "./StarDistribution";
import styles from "./styles/RatingsOverview.module.css";

export default function RatingsOverview({ averageRating, totalReviews, starCounts }) {
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
            <TrackProgress variant="determinate" value={100} size={180} thickness={3.4} />
            <FilledProgress variant="determinate" value={progressValue} size={180} thickness={3.4} />
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
              <Typography variant="body1" component="div" className={styles.circularInnerText}>
                {averageRating.toFixed(2)}
              </Typography>
            </Box>
          </CircularContainer>
        </Box>
        <div className={styles.basedOnReviews}>Based on {totalReviews} reviews</div>
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
        <StarDistribution starCounts={starCounts} totalReviews={totalReviews} />
      </div>
    </div>
  );
}
