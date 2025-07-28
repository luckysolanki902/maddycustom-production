// src/components/page-sections/product-id-page/rating-section/ReviewCard.js
import React from 'react';
import { Box, Typography, Avatar, Chip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import PersonIcon from '@mui/icons-material/Person';

const ReviewCard = ({ 
  rating = 4, 
  status = 'approved', 
  name = 'Maddy Singh', 
  comment = 'Awesome', 
  date = '16/08/2025', 
  fullWidth = false 
}) => {
  // Remove any leading CSS-like code from the comment
  let cleanComment = comment;
  // Remove up to and including the first occurrence of ;}} or }};
  const cssJunkMatch = cleanComment.match(/^[^}]*;}}|^[^}]*}};/);
  if (cssJunkMatch) {
    cleanComment = cleanComment.slice(cssJunkMatch[0].length);
  }
  // Also trim leading whitespace/semicolon
  cleanComment = cleanComment.replace(/^\s*;?/, "");
  return (
    <Box sx={{
      backgroundColor: "#fafafa",
      borderRadius: "16px",
      padding: { xs: "1.5rem", md: "2rem" },
      border: "1px solid rgba(45, 45, 45, 0.08)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      position: "relative",
      "&:hover": {
        boxShadow: "0 8px 32px rgba(45, 45, 45, 0.12)",
        transform: "translateY(-2px)",
        borderColor: "rgba(45, 45, 45, 0.15)",
      }
    }}>
      {/* Header with Rating and Date */}
      <Box sx={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: 2
      }}>
        <Box sx={{ display: "flex", gap: 0.3 }}>
          {[...Array(5)].map((_, index) => (
            <StarIcon
              key={index}
              sx={{
                fontSize: "1.2rem",
                color: index < rating ? "#FFD700" : "rgba(45, 45, 45, 0.2)",
                transition: "color 0.2s ease",
              }}
            />
          ))}
        </Box>
        
        <Typography sx={{
          fontSize: "0.85rem",
          color: "#666",
          fontFamily: "Jost, sans-serif",
          fontWeight: "400"
        }}>
          {date}
        </Typography>
      </Box>

      {/* User Info and Status */}
      <Box sx={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: 1.5
      }}>
        <Box sx={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 1.5
        }}>
          <Avatar sx={{
            width: 48,
            height: 48,
            backgroundColor: "#2d2d2d",
            color: "white",
            fontSize: "1.2rem",
            fontFamily: "Jost, sans-serif",
            fontWeight: "600"
          }}>
            {name.charAt(0).toUpperCase()}
          </Avatar>
          
          <Box>
            <Typography sx={{
              fontSize: "1rem",
              fontWeight: "600",
              color: "#2d2d2d",
              fontFamily: "Jost, sans-serif",
              lineHeight: 1.2
            }}>
              {name}
            </Typography>
            <Typography sx={{
              fontSize: "0.85rem",
              color: "#666",
              fontFamily: "Jost, sans-serif",
              fontWeight: "400"
            }}>
              Verified Customer
            </Typography>
          </Box>
        </Box>

        {/* Status Badge */}
        {status !== 'approved' && (
          <Chip
            label={status.charAt(0).toUpperCase() + status.slice(1)}
            size="small"
            sx={{
              backgroundColor: status === 'rejected' ? "#fee" : "#fef3cd",
              color: status === 'rejected' ? "#dc3545" : "#856404",
              fontFamily: "Jost, sans-serif",
              fontWeight: "500",
              fontSize: "0.75rem",
              height: "24px"
            }}
          />
        )}
      </Box>

      {/* Comment */}
      <Typography sx={{
        fontSize: "0.95rem",
        color: "#444",
        fontFamily: "Jost, sans-serif",
        lineHeight: 1.6,
        fontWeight: "400",
        position: "relative",
        paddingLeft: "1.2rem",
        minHeight: "1.5em",
        "&::before": cleanComment ? {
          content: '"\\201C"', // Unicode left double quote
          position: "absolute",
          left: 0,
          top: "-0.1rem",
          fontSize: "1.5rem",
          color: "#2d2d2d",
          fontWeight: "700",
          opacity: 0.18
        } : undefined
      }}>
        {cleanComment}
      </Typography>
    </Box>
  );
};

export default ReviewCard;
