import React from "react";
import { Box, LinearProgress, Typography, Skeleton } from "@mui/material";
import styles from "./styles/StarDistribution.module.css";

export default function StarDistribution({
  starCounts,
  totalReviews,
  variant,
  loading,
}) {
  if (loading) {
    // Show skeleton lines
    return (
      <div className={styles.starDistribution}>
        {[...Array(5)].map((_, idx) => (
          <Skeleton
            key={idx}
            variant="rectangular"
            height={20}
            sx={{ my: 1, borderRadius: "4px" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.starDistribution}>
      {starCounts.map(({ star, count }) => {
        const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
        return (
          <div key={star} className={styles.starRow}>
            {/* Star Label */}
            <Box variant="body2" className={styles.starLabel}>
              {star}
              <span>★</span>
            </Box>

            {/* Progress Bar */}
            <Box className={styles.progressBarWrapper}>
              <LinearProgress
                variant="determinate"
                value={percentage}
                className={styles.linearProgress}
                sx={{
                  borderRadius: 5,
                  backgroundColor: "#dedede",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "#00ec23",
                    borderRadius: "0 5px 5px 0",
                  },
                }}
              />
            </Box>

            {/* Count */}
            <Typography variant="body2" className={styles.starCount}>
              {count}
            </Typography>
          </div>
        );
      })}
    </div>
  );
}
