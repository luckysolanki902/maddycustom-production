"use client";

import React from "react";
import { Box, LinearProgress, Typography } from "@mui/material";
import styles from "./styles/StarDistribution.module.css";

/**
 * Props:
 * - starCounts: Array of objects (e.g., [{ star: 5, count: 49 }, { star: 4, count: 30 }, ...])
 * - totalReviews: Number of total reviews
 */
export default function StarDistribution({ starCounts, totalReviews }) {
    return (
        <div className={styles.starDistribution}>
            {starCounts.map(({ star, count }) => {
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                    <div key={star} className={styles.starRow}>
                        {/* Star Label */}
                        <Box variant="body2" className={styles.starLabel}>
                            {star}
                            <span>
                                ★
                            </span>
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
                                        backgroundColor: "#00ec23", // Green color for the progress bar
                                        borderRadius: "0 5px 5px 0", // Rounded on one side
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
