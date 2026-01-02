import React from "react";
import { Box, LinearProgress, Typography, Skeleton } from "@mui/material";
import StarIcon from "@mui/icons-material/Star";

export default function StarDistribution({
  starCounts,
  totalReviews,
  variant,
  loading,
}) {
  if (loading) {
    return (
      <Box sx={{ width: "100%" }}>
        {[...Array(5)].map((_, idx) => (
          <Skeleton
            key={idx}
            variant="rectangular"
            height={24}
            sx={{ 
              my: 1.5, 
              borderRadius: "12px",
              width: "100%",
              maxWidth: "400px"
            }}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ 
      width: "100%", 
      maxWidth: "450px",
      margin: { xs: "0 auto", md: "0" }
    }}>
      {starCounts.map(({ star, count }) => {
        const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
        return (
          <Box 
            key={star} 
            sx={{ 
              display: "flex", 
              alignItems: "center", 
              gap: { xs: 1, md: 2.5 },
              marginBottom: { xs: 1, md: 1.8 },
              "&:last-child": { marginBottom: 0 }
            }}
          >
            {/* Star Label */}
            <Box sx={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 0.3,
              minWidth: { xs: "35px", md: "55px" },
              justifyContent: "flex-start"
            }}>
              <Typography sx={{
                fontSize: { xs: "0.8rem", md: "0.95rem" },
                fontWeight: "600",
                color: "#2d2d2d",
                fontFamily: "Jost, sans-serif"
              }}>
                {star}
              </Typography>
              <StarIcon sx={{ 
                fontSize: { xs: "0.85rem", md: "1.1rem" }, 
                color: "#28a745" 
              }} />
            </Box>

            {/* Progress Bar */}
            <Box sx={{ 
              flex: 1, 
              position: "relative",
              height: { xs: "6px", md: "8px" }
            }}>
              <LinearProgress
                variant="determinate"
                value={percentage}
                sx={{
                  height: { xs: "6px", md: "8px" },
                  borderRadius: "4px",
                  backgroundColor: "rgba(0, 0, 0, 0.04)",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "#28a745",
                    borderRadius: "4px",
                    transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  },
                }}
              />
            </Box>

            {/* Count */}
            <Typography sx={{
              fontSize: { xs: "0.75rem", md: "0.9rem" },
              fontWeight: "500",
              color: "#888",
              fontFamily: "Jost, sans-serif",
              minWidth: { xs: "25px", md: "35px" },
              textAlign: "right"
            }}>
              {count.toLocaleString()}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
