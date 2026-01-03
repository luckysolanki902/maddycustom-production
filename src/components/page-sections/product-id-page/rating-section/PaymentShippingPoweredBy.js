import React from "react";
import { Box, Typography } from "@mui/material";
import Image from "next/image";
import SecurityIcon from '@mui/icons-material/Security';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

const PaymentShippingPoweredBy = () => {
  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <Box sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      backgroundColor: "white",
      borderRadius: "16px",
      padding: { xs: "1.5rem", md: "2rem" },
      maxWidth: "500px",
      width: "100%",
      textAlign: "center",
      border: "1px solid rgba(45, 45, 45, 0.08)",
      boxShadow: "0 4px 4px rgba(0, 0, 0, 0.1)",
      position: "relative",
      // "&::before": {
      //   content: '""',
      //   position: "absolute",
      //   top: 0,
      //   left: "50%",
      //   transform: "translateX(-50%)",
      //   width: "60px",
      //   height: "3px",
      //   background: "linear-gradient(90deg, #2d2d2d 0%, #4a4a4a 100%)",
      //   borderRadius: "0 0 4px 4px",
      // }
    }}>

      {/* Text */}
      <Typography sx={{
        fontSize: { xs: "0.95rem", md: "1rem" },
        fontWeight: "600",
        color: "#2d2d2d",
        fontFamily: "Jost, sans-serif",
        marginBottom: 0.5,
        lineHeight: 1.3,
      }}>
        Payment and shipping powered by
      </Typography>
      
      {/* <Typography sx={{
        fontSize: { xs: "0.85rem", md: "0.9rem" },
        fontWeight: "400",
        color: "#666",
        fontFamily: "Jost, sans-serif",
        marginBottom: 2,
        lineHeight: 1.4,
      }}>
        Trusted by thousands of customers nationwide
      </Typography> */}

      {/* Logos */}
      <Box sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: { xs: 2, md: 3 },
        flexWrap: "wrap"
      }}>
        <Box sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          // padding: "0.5rem 1rem",
          // backgroundColor: "#f8f9fa",
          // borderRadius: "8px",
          // border: "1px solid rgba(45, 45, 45, 0.05)"
        }}>
          <Image
            src={`${baseImageUrl}/assets/icons/shiprocket_logo.svg`}
            alt="Shiprocket"
            width={80}
            height={24}
            style={{ opacity: 0.8 }}
          />
        </Box>

        <Box sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          // padding: "0.5rem 1rem",
          // backgroundColor: "#f8f9fa",
          // borderRadius: "8px",
          // border: "1px solid rgba(45, 45, 45, 0.05)"
        }}>
          <Image
            src={`${baseImageUrl}/assets/icons/razorpay_logo.svg`}
            alt="Razorpay"
            width={80}
            height={24}
            style={{ opacity: 0.8 }}
          />
        </Box>
      </Box>

      {/* Trust Indicators */}
      {/* <Box sx={{
        display: "flex",
        gap: { xs: 1, md: 2 },
        marginTop: 2,
        flexWrap: "wrap",
        justifyContent: "center"
      }}>
        <Typography sx={{
          fontSize: "0.75rem",
          color: "#999",
          fontFamily: "Jost, sans-serif",
          padding: "0.25rem 0.75rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "12px",
          border: "1px solid rgba(45, 45, 45, 0.05)"
        }}>
          Premimum Quality
        </Typography>
        <Typography sx={{
          fontSize: "0.75rem",
          color: "#999",
          fontFamily: "Jost, sans-serif",
          padding: "0.25rem 0.75rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "12px",
          border: "1px solid rgba(45, 45, 45, 0.05)"
        }}>
          Fast Delivery
        </Typography>
        <Typography sx={{
          fontSize: "0.75rem",
          color: "#999",
          fontFamily: "Jost, sans-serif",
          padding: "0.25rem 0.75rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "12px",
          border: "1px solid rgba(45, 45, 45, 0.05)"
        }}>
          24/7 Support
        </Typography>
      </Box> */}
    </Box>
  );
};

export default PaymentShippingPoweredBy;
