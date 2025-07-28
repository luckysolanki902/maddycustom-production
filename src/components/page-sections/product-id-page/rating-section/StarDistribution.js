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
      maxWidth: "400px",
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
              gap: 2,
              marginBottom: 1.5,
              "&:last-child": { marginBottom: 0 }
            }}
          >
            {/* Star Label */}
            <Box sx={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 0.5,
              minWidth: "60px",
              justifyContent: "flex-start"
            }}>
              <Typography sx={{
                fontSize: "0.9rem",
                fontWeight: "500",
                color: "#2d2d2d",
                fontFamily: "Jost, sans-serif"
              }}>
                {star}
              </Typography>
              <StarIcon sx={{ 
                fontSize: "1rem", 
                color: "#FFD700" 
              }} />
            </Box>

            {/* Progress Bar */}
            <Box sx={{ 
              flex: 1, 
              position: "relative",
              height: "8px"
            }}>
              <LinearProgress
                variant="determinate"
                value={percentage}
                sx={{
                  height: "8px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(45, 45, 45, 0.08)",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "#2d2d2d",
                    borderRadius: "4px",
                    transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                  },
                }}
              />
            </Box>

            {/* Count */}
            <Typography sx={{
              fontSize: "0.9rem",
              fontWeight: "600",
              color: "#2d2d2d",
              fontFamily: "Jost, sans-serif",
              minWidth: "40px",
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
