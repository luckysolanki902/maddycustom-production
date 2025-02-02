import React from "react";
import { Box, Typography } from "@mui/material";
import Image from "next/image";

const PaymentShippingPoweredBy = () => {
    const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#EAFBEF",
        borderRadius: "12px",
        padding: "12px 16px",
        maxWidth: { xs: "70%", md: "350px" },
        textAlign: "center",
        boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.1)",
        flex:1
      }}>
      {/* Text */}
      <Typography
        variant="body2"
        sx={{
          fontSize: "0.9rem",
          fontWeight: 500,
          color: "#333",
          lineHeight: 1.3,
        }}
      >
        Payment and shipping
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontSize: "0.9rem",
          fontWeight: 500,
          color: "#333",
          lineHeight: 1.3,
        }}
      >
        powered by
      </Typography>

      {/* Logos */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "8px",
          gap: "12px",
        }}
      >
        {/* Shiprocket Logo */}
        <Image
          src={`${baseImageUrl}/assets/icons/shiprocket_logo.svg`}
          alt="Shiprocket Logo"
          width={90}
          height={30}
        />

        {/* Razorpay Logo */}
        <Image
          src={`${baseImageUrl}/assets/icons/razorpay_logo.svg`}
          alt="Razorpay Logo"
          width={90}
          height={30}
        />
      </Box>
    </Box>
  );
};

export default PaymentShippingPoweredBy;
