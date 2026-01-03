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
  images = [],
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

  const imageBaseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <Box sx={{
      backgroundColor: "white",
      borderRadius: "20px",
      padding: { xs: "0.5rem", md: "1rem" },
      border: "1px solid rgba(45, 45, 45, 0.06)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 2.5,
      "&:hover": {
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.04)",
        transform: "translateY(-2px)",
        borderColor: "rgba(45, 45, 45, 0.12)",
      }
    }}>
      {/* User Info and Status */}
      <Box sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <Box sx={{
          display: "flex",
          alignItems: "center",
          gap: 2
        }}>
          <Avatar sx={{
            width: 44,
            height: 44,
            backgroundColor: "#f0f0f0",
            color: "#2d2d2d",
            fontSize: "1.1rem",
            fontFamily: "Jost, sans-serif",
            fontWeight: "600",
            border: "1px solid rgba(0,0,0,0.05)"
          }}>
            {name.charAt(0).toUpperCase()}
          </Avatar>

          <Box>
            <Typography sx={{
              fontSize: "1.05rem",
              fontWeight: "600",
              color: "#2d2d2d",
              fontFamily: "Jost, sans-serif",
              lineHeight: 1.2
            }}>
              {name}
            </Typography>
            <Typography sx={{
              fontSize: "0.8rem",
              color: "#888",
              fontFamily: "Jost, sans-serif",
              fontWeight: "400"
            }}>
              Verified Buyer
            </Typography>
          </Box>
        </Box>


      </Box>

      {/* Review Images */}
      {images && images.length > 0 && (
        <Box sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 1,
          "&::-webkit-scrollbar": { display: "none" }
        }}>
          {images.map((img, idx) => (
            <Box
              key={idx}
              component="img"
              src={img.startsWith('http') ? img : `${imageBaseUrl}/${img}`}
              alt={`Review image ${idx + 1}`}
              sx={{
                width: { xs: "100%", sm: "280px", md: "320px" },
                aspectRatio: "1/1",
                objectFit: "cover",
                borderRadius: "16px",
                flexShrink: 0,
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                border: "1px solid rgba(0,0,0,0.03)"
              }}
            />
          ))}
        </Box>
      )}

      {/* Comment */}
      <Box>

        {/* <Typography sx={{
          fontSize: "0.75rem",
          color: "#aaa",
          fontFamily: "Jost, sans-serif",
          marginTop: 2,
          fontWeight: "500",
          textTransform: "uppercase",
          letterSpacing: "0.05em"
        }}>
          Posted on {date}
        </Typography> */}

        {/* Rating */}
        <Box sx={{ display: "flex", gap: 0.2 }}>
          {[...Array(5)].map((_, index) => (
            <StarIcon
              key={index}
              sx={{
                fontSize: "1.1rem",
                color: index < rating ? "#28a745" : "rgba(45, 45, 45, 0.1)",
              }}
            />
          ))}
        </Box>

        <Typography sx={{
          fontSize: "1rem",
          color: "#444",
          fontFamily: "Jost, sans-serif",
          lineHeight: 1.7,
          fontWeight: "400",
          letterSpacing: "0.01em"
        }}>
          {cleanComment}
        </Typography>

      </Box>
    </Box>
  );
};

export default ReviewCard;
