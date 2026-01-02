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
    color: "rgba(40, 167, 69, 0.08)",
  }));

  const FilledProgress = styled(CircularProgress)(({ theme }) => ({
    color: "#28a745",
    position: "absolute",
    left: 0,
    "& .MuiCircularProgress-circle": {
      strokeLinecap: "round",
    },
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
      flexDirection: "row",
      gap: { xs: 2, sm: 6, md: 10 },
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      py: { xs: 1, md: 2 }
    }}>
      {/* Left - Circular Rating Display */}
      <Box sx={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center",
        flex: "0 0 auto",
      }}>
        <Box sx={{ 
          position: "relative",
          width: { xs: "105px", md: "165px" },
          height: { xs: "105px", md: "165px" },
          borderRadius: "50%",
          background: "radial-gradient(circle, #ffffff 0%, #fcfcfc 100%)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.05), inset 0 0 0 1px rgba(0,0,0,0.02)",
          border: "1px solid rgba(0,0,0,0.03)",
          marginBottom: { xs: 1, md: 2 },
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <CircularContainer>
            <TrackProgress
              variant="determinate"
              value={100}
              size={isSmallDevice ? 85 : 135}
              thickness={4.5}
            />
            <FilledProgress
              variant="determinate"
              value={progressValue}
              size={isSmallDevice ? 85 : 135}
              thickness={4.5}
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
            }}>
              <Typography sx={{
                fontSize: { xs: "1.6rem", md: "2.5rem" },
                fontWeight: "700",
                color: "#2d2d2d",
                fontFamily: "Jost, sans-serif",
                lineHeight: 1
              }}>
                {averageRating.toFixed(1)}
              </Typography>
            </Box>
          </CircularContainer>
        </Box>
        
        <Typography sx={{
          fontSize: { xs: "0.8rem", md: "1rem" },
          fontWeight: "600",
          color: "#2d2d2d",
          fontFamily: "Jost, sans-serif",
          letterSpacing: "0.02em"
        }}>
          {totalReviews} Reviews
        </Typography>
      </Box>

      {/* Right - Star Distribution */}
      <Box sx={{ 
        flex: { xs: "1 1 auto", sm: "0 1 400px" }, 
        width: "100%",
        maxWidth: { xs: "220px", sm: "450px" }
      }}>
        <StarDistribution 
          starCounts={starCounts} 
          totalReviews={totalReviews} 
          loading={loading}
        />
      </Box>
    </Box>
  );
}
