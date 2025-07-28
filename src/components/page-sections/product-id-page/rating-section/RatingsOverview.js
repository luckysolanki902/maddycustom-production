"use client";
import React from "react";
import { Box, CircularProgress, Divider, Typography, Skeleton } from "@mui/material";
import { styled, useMediaQuery } from "@mui/system";
import StarDistribution from "./StarDistribution";
import StarIcon from "@mui/icons-material/Star";

export default function RatingsOverview({
  averageRating = 0,
  totalReviews = 0,
  starCounts = [],
  variant,
  loading,
}) {
  const isSmallDevice = useMediaQuery("(max-width: 600px)");
  const isMediumDevice = useMediaQuery("(max-width: 900px)");
  const progressValue = (averageRating / 5) * 100;

  const CircularContainer = styled(Box)({
    position: "relative",
    display: "inline-flex",
  });

  const TrackProgress = styled(CircularProgress)(({ theme }) => ({
    color: "rgba(45, 45, 45, 0.1)",
  }));

  const FilledProgress = styled(CircularProgress)(({ theme }) => ({
    color: "#2d2d2d",
    position: "absolute",
    left: 0,
  }));

  // Loading skeleton
  if (loading) {
    return (
      <Box sx={{ 
        display: "flex", 
        flexDirection: { xs: "column", md: "row" },
        gap: { xs: 3, md: 4 },
        alignItems: "center"
      }}>
        <Box sx={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center",
          flex: "0 0 auto"
        }}>
          <Skeleton
            variant="circular"
            width={isSmallDevice ? 120 : 160}
            height={isSmallDevice ? 120 : 160}
            sx={{ marginBottom: 2 }}
          />
          <Skeleton variant="text" width={150} height={24} />
        </Box>
        
        <Divider 
          orientation={isSmallDevice ? "horizontal" : "vertical"} 
          flexItem 
          sx={{ 
            display: { xs: "none", md: "block" },
            borderColor: "rgba(45, 45, 45, 0.1)"
          }} 
        />
        
        <Box sx={{ flex: 1, width: "100%" }}>
          {[...Array(5)].map((_, idx) => (
            <Skeleton
              key={idx}
              variant="rectangular"
              height={isSmallDevice ? 20 : 24}
              sx={{ 
                my: 1, 
                borderRadius: "12px", 
                width: "100%",
                maxWidth: "400px"
              }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      display: "flex", 
      flexDirection: { xs: "column", md: "row" },
      gap: { xs: 3, md: 4 },
      alignItems: "center"
    }}>
      {/* Left - Circular Rating Display */}
      <Box sx={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center",
        flex: "0 0 auto"
      }}>
        <Box sx={{ 
          position: "relative",
          padding: "1rem",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
          boxShadow: "0 8px 32px rgba(45, 45, 45, 0.1)",
          marginBottom: 2
        }}>
          <CircularContainer>
            <TrackProgress
              variant="determinate"
              value={100}
              size={isSmallDevice ? 120 : 160}
              thickness={3}
            />
            <FilledProgress
              variant="determinate"
              value={progressValue}
              size={isSmallDevice ? 120 : 160}
              thickness={3}
            />
            <Box sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: "absolute",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.5
            }}>
              <Typography sx={{
                fontSize: { xs: "2rem", md: "2.5rem" },
                fontWeight: "700",
                color: "#2d2d2d",
                fontFamily: "Jost, sans-serif",
                lineHeight: 1
              }}>
                {averageRating.toFixed(1)}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.2 }}>
                {[...Array(5)].map((_, index) => (
                  <StarIcon
                    key={index}
                    sx={{
                      fontSize: { xs: "0.8rem", md: "1rem" },
                      color: index < Math.round(averageRating) ? "#FFD700" : "rgba(45, 45, 45, 0.2)",
                    }}
                  />
                ))}
              </Box>
            </Box>
          </CircularContainer>
        </Box>
        
        <Typography sx={{
          fontSize: { xs: "0.9rem", md: "1rem" },
          color: "#666",
          fontFamily: "Jost, sans-serif",
          textAlign: "center",
          fontWeight: "500"
        }}>
          Based on {totalReviews.toLocaleString()} reviews
        </Typography>
      </Box>

      {/* Center Divider */}
      <Divider 
        orientation={isSmallDevice ? "horizontal" : "vertical"} 
        flexItem 
        sx={{ 
          display: { xs: "none", md: "block" },
          borderColor: "rgba(45, 45, 45, 0.1)",
          margin: { xs: 0, md: "0 1rem" }
        }} 
      />

      {/* Right - Star Distribution */}
      <Box sx={{ flex: 1, width: "100%" }}>
        <StarDistribution
          starCounts={starCounts}
          totalReviews={totalReviews}
          variant={variant}
        />
      </Box>
    </Box>
  );
}
