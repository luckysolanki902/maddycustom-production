"use client";
import Image from "next/image";
import React, { useState, useEffect } from "react";
import {
  Button,
  TextField,
  Box,
  Typography,
  Paper,
  Container,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Slide,
  Divider,
  Chip
} from "@mui/material";
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SearchIcon from '@mui/icons-material/Search';
import SpeedIcon from '@mui/icons-material/Speed';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import TimelineIcon from '@mui/icons-material/Timeline';
import LaunchIcon from '@mui/icons-material/Launch';
import MapIcon from '@mui/icons-material/Map';
import InputAdornment from '@mui/material/InputAdornment';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { useSpring, animated, config } from 'react-spring';
import Link from 'next/link';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const AnimatedBox = animated(Box);
const AnimatedPaper = animated(Paper);
const AnimatedTypography = animated(Typography);
const AnimatedButton = animated(Button);

export default function TrackPage() {
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [orderDetails, setOrderDetails] = useState(null);
  const [groupInfo, setGroupInfo] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const baseImageUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;

  // React Spring animations
  const fadeIn = useSpring({
    from: { opacity: 0 },
    to: { opacity: 1 },
    config: { tension: 120, friction: 14 }
  });

  const slideUp = useSpring({
    from: { transform: 'translateY(50px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
    delay: 200,
    config: { mass: 1, tension: 180, friction: 18 }
  });

  const raceInFromLeft = useSpring({
    from: { transform: 'translateX(-200px) scale(0.8)', opacity: 0 },
    to: { transform: 'translateX(0) scale(1)', opacity: 1 },
    delay: 300,
    config: { mass: 2, tension: 180, friction: 24 }
  });

  const raceInFromRight = useSpring({
    from: { transform: 'translateX(200px) scale(0.8)', opacity: 0 },
    to: { transform: 'translateX(0) scale(1)', opacity: 1 },
    delay: 400,
    config: { mass: 2, tension: 180, friction: 24 }
  });

  const pulseAnimation = useSpring({
    from: { scale: 1 },
    to: { scale: 1.05 },
    config: { tension: 200, friction: 10, duration: 800 },
    loop: { reverse: true },
  });

  // Track if component is mounted to handle hydration issues
  const [isMounted, setIsMounted] = useState(false);

  // Handle initial hydration - this ensures all client-side code runs only after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // On mount, check if the URL contains a query parameter for orderId
  useEffect(() => {
    // Only run effect when component is mounted (after hydration)
    if (!isMounted) return;

    const params = new URLSearchParams(window.location.search);
    const orderIdParam = params.get("orderId");
    if (orderIdParam) {
      setOrderId(orderIdParam);
      // Define trackOrder inside to avoid dependency issues
      const trackOrder = async (id) => {
        if (!id) return;

        setLoading(true);
        setError("");
        setSuccess("");

        try {
          const response = await fetch(`/api/order/track?orderId=${id}`);
          const data = await response.json();

          if (response.ok) {
            if (data.trackingData) {
              setOrderDetails(data.trackingData);
              setGroupInfo(data.group || null);
              setShowDetailDialog(true);
            } else if (data.trackUrl) {
              window.open(data.trackUrl, "_blank");
              setSuccess("Tracking information opened in a new tab");
            } else {
              setSuccess(data.message || "Order found!");
            }
          } else {
            setError(data.message || "Failed to track order");
          }
        } catch (error) {
          console.error("Error tracking order:", error);
          setError("Network error while tracking order");
        } finally {
          setLoading(false);
        }
      };

      trackOrder(orderIdParam);
    }
  }, [isMounted]);

  const handleTrackOrder = async (id = orderId) => {
    if (!id) {
      setError("Please enter your Order ID");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/order/track?orderId=${id}`);
  const data = await response.json();

      if (response.ok) {
        if (data.trackingData) {
          setOrderDetails(data.trackingData);
          setGroupInfo(data.group || null);
          setShowDetailDialog(true);
        } else if (data.trackUrl) {
          // If we have a redirect URL, open it in a new tab
          window.open(data.trackUrl, "_blank");
          setSuccess("Tracking information opened in a new tab");
        } else {
          setSuccess(data.message || "Order found!");
        }
      } else {
        setError(data.message || "Failed to track order");
      }
    } catch (error) {
      console.error("Error tracking order:", error);
      setError("Network error while tracking order");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }
    setError("");
    setSuccess("");
  };
  return (
    <>
      <AnimatedBox
        style={fadeIn}
        sx={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: { xs: "1rem", sm: "2rem" },
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Animated Background Graphics - Racing Stripes */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.03,
            zIndex: 1,
            background: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 20px,
              #2d2d2d 20px,
              #2d2d2d 40px
            )`,
          }}
        />

        {/* Animated Racing Line */}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "0",
            width: "100%",
            height: "5px",
            background: "#2d2d2d",
            opacity: 0.1,
            zIndex: 1,
            "&:before": {
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, transparent 0%, #2d2d2d 50%, transparent 100%)",
              animation: "racingLight 2s infinite linear",
            },
            "@keyframes racingLight": {
              "0%": { transform: "translateX(-100%)" },
              "100%": { transform: "translateX(100%)" },
            }
          }}
        />

        {/* Accent Circle */}
        <AnimatedBox
          style={pulseAnimation}
          sx={{
            position: "absolute",
            bottom: "-50px",
            right: "-50px",
            width: { xs: "150px", sm: "300px" },
            height: { xs: "150px", sm: "300px" },
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(45,45,45,0.1) 0%, rgba(45,45,45,0) 70%)",
            zIndex: 1,
          }}
        />
        <Container maxWidth="md" sx={{ zIndex: 2, position: "relative" }}>
          <AnimatedPaper
            style={slideUp}
            elevation={10}
            sx={{
              borderRadius: "16px",
              overflow: "hidden",
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(0,0,0,0.05)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                height: { md: "500px" },
              }}
            >
              {/* Left Side - Graphics/Info */}
              <AnimatedBox
                style={raceInFromLeft}
                sx={{
                  flex: { xs: "0 0 auto", md: "0 0 40%" },
                  background: "#2d2d2d",
                  color: "white",
                  // display: "flex",
                  display: { xs: "none", md: "flex" },
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "2rem",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Animated Speed Lines */}
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    opacity: 0.1,
                    backgroundSize: "200% 200%",
                    backgroundImage: "linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%, transparent)",
                    backgroundSize: "20px 20px",
                    animation: "moveLines 1s linear infinite",
                    "@keyframes moveLines": {
                      "0%": { backgroundPosition: "0 0" },
                      "100%": { backgroundPosition: "40px 40px" },
                    }
                  }}
                />

                {/* Logo */}
                <Box
                  sx={{
                    position: "relative",
                    width: "80%",
                    maxWidth: "300px",
                    marginBottom: "2rem"
                  }}
                >
                  <Image
                    src={`${baseImageUrl}/assets/logos/md_logo_with_subtitle.png`}
                    width={500}
                    height={150}
                    alt="MD Wraps"
                    style={{ width: "100%", height: "auto", filter: 'invert(1)' }}
                  />
                </Box>

                {/* Graphics and iconography */}
                <AnimatedBox
                  style={pulseAnimation}
                  sx={{
                    // display: "flex",
                    display: { xs: "none", md: "flex" },
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "1rem",
                    zIndex: 2
                  }}
                >
                  <SpeedIcon sx={{ fontSize: 50, color: "#ffffff" }} />
                  <AnimatedTypography
                    variant="h5"
                    sx={{
                      textTransform: "uppercase",
                      fontWeight: 700,
                      textAlign: "center",
                      letterSpacing: "1px"
                    }}
                  >
                    Real-time Tracking
                  </AnimatedTypography>

                </AnimatedBox>
              </AnimatedBox>

              {/* Right Side - Tracking Form */}
              <AnimatedBox
                style={raceInFromRight}
                sx={{
                  flex: "1 1 auto",
                  padding: { xs: "2rem", md: "3rem" },
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  background: "white",
                }}
              >                <AnimatedTypography
                component="h1"
                style={slideUp}
                sx={{
                  fontSize: { xs: "1.75rem", md: "2.25rem" },
                  fontWeight: 800,
                  color: "#2d2d2d",
                  marginBottom: "0.5rem",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  position: "relative",
                  display: "inline-block",
                  "&:after": {
                    content: '""',
                    position: "absolute",
                    bottom: "-8px",
                    left: "0",
                    width: "80px",
                    height: "4px",
                    background: "#2d2d2d",
                    borderRadius: "2px",
                  }
                }}
              >
                  Track Your Order
                </AnimatedTypography>

                <AnimatedTypography
                  variant="body1"
                  style={{ ...slideUp, delay: 300 }}
                  sx={{
                    color: "#666",
                    marginBottom: "2rem",
                    marginTop: "1rem"
                  }}
                >
                  Enter your order ID to get real-time delivery status
                </AnimatedTypography>

                <TextField
                  label="Order ID"
                  variant="outlined"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  fullWidth
                  sx={{
                    marginBottom: "2rem",
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "8px",
                      backgroundColor: "white",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      "& fieldset": {
                        borderColor: "rgba(45,45,45,0.2)",
                      },
                      "&:hover fieldset": {
                        borderColor: "rgba(45,45,45,0.4)",
                      },
                      "&.Mui-focused fieldset": {
                        borderColor: "#2d2d2d",
                      },
                    },
                    "& .MuiInputLabel-root": {
                      color: "#666",
                    },
                    "& .MuiInputBase-input": {
                      color: "#2d2d2d",
                    },
                    "& .MuiInputAdornment-root": {
                      color: "rgba(45,45,45,0.6)",
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />

                <AnimatedButton
                  style={{
                    ...slideUp,
                    delay: 500,
                    transform: loading ? 'scale(1.0)' : pulseAnimation.scale
                  }}
                  variant="contained"
                  onClick={() => handleTrackOrder()}
                  disabled={loading || !orderId}
                  sx={{
                    backgroundColor: "#2d2d2d",
                    color: "white",
                    borderRadius: "8px",
                    padding: "0.75rem 2rem",
                    fontWeight: 600,
                    textTransform: "none",
                    fontSize: "1.1rem",
                    position: "relative",
                    overflow: "hidden",
                    "&:hover": {
                      backgroundColor: "#1a1a1a",
                    },
                    "&:before": {
                      content: '""',
                      position: "absolute",
                      top: "0",
                      left: "-100%",
                      width: "100%",
                      height: "100%",
                      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                      animation: "shine 1.5s infinite",
                    },
                    "@keyframes shine": {
                      "0%": { left: "-100%" },
                      "100%": { left: "100%" },
                    },
                    boxShadow: "0 4px 12px rgba(45,45,45,0.3)",
                    transition: "all 0.3s ease",
                  }}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LocalShippingIcon />}
                >
                  {loading ? "Tracking..." : "Track Order"}
                </AnimatedButton>                <AnimatedBox
                  style={{ ...slideUp, delay: 700 }}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginTop: "3rem",
                    gap: "0.75rem"
                  }}
                >
                  <Divider sx={{ width: "100%", borderColor: "rgba(45,45,45,0.1)" }} />
                  <Typography variant="body2" color="#666" textAlign="center">
                    Need help with your order? Contact our support team at <br />
                    <Link href="/faqs" color="#2d2d2d" sx={{ fontWeight: 600 }}>
                      <Typography component="span" color="#2d2d2d" sx={{ fontWeight: 600 }}>
                        {"Customer Support Page"}
                      </Typography>
                    </Link>
                  </Typography>
                </AnimatedBox>
              </AnimatedBox>
            </Box>
          </AnimatedPaper>
        </Container>
      </AnimatedBox>
      {/* Order Details Dialog */}
      <Dialog
        open={showDetailDialog}
        TransitionComponent={Transition}
        keepMounted
        onClose={() => setShowDetailDialog(false)}
        aria-describedby="order-tracking-details"
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: "16px",
            background: "white",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(0,0,0,0.05)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "5px",
            background: "linear-gradient(to right, #2d2d2d 0%, #555 100%)",
            backgroundSize: "200% 100%",
            animation: "gradientSlide 2s linear infinite",
            "@keyframes gradientSlide": {
              "0%": { backgroundPosition: "0% 0%" },
              "100%": { backgroundPosition: "200% 0%" }
            }
          }}
        />

          <DialogTitle sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#2d2d2d",
          color: "white",
          borderBottom: "1px solid rgba(255,255,255,0.05)"
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <TimelineIcon sx={{ color: "white" }} />
            <Typography variant="h6" component="span">
              Order Tracking Details
            </Typography>
          </Box>

          <IconButton
            aria-label="close"
            onClick={() => setShowDetailDialog(false)}
            sx={{ color: "rgba(255,255,255,0.9)" }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ padding: 0 }}>
          {orderDetails && (
            <Box sx={{ color: "#333", padding: "1.5rem" }}>
              {groupInfo && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" color="#2d2d2d" fontWeight="600" gutterBottom>
                    Grouped Order Summary
                  </Typography>
                  <Paper sx={{ p: 2, borderRadius: '12px', bgcolor: '#f3f4f6', mb:2 }}>
                    <Typography variant="body2" color="#555">Group ID: <strong>{groupInfo.groupId}</strong></Typography>
                    <Typography variant="body2" color="#555">Total Orders: {groupInfo.orders?.length || 0}</Typography>
                    <Typography variant="body2" color="#555">Total Amount: ₹{groupInfo.aggregate?.total || 0}</Typography>
                    {(groupInfo.aggregate?.dueCod || 0) > 0 && (
                      <Typography variant="body2" color="#555">Remaining COD: ₹{groupInfo.aggregate.dueCod}</Typography>
                    )}
                  </Paper>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {groupInfo.orders?.map(o => (
                      <Paper key={o._id} sx={{ p:1.5, display:'flex', justifyContent:'space-between', alignItems:'center', borderRadius:'10px', bgcolor: '#fafafa', border:'1px solid #eee' }}>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>Order: {o._id}</Typography>
                          <Typography variant="caption" color="#666">Partition: {o.partitionKey || 'n/a'}</Typography>
                        </Box>
                        <Box sx={{ display:'flex', gap:1, alignItems:'center' }}>
                          <Chip size="small" label={o.paymentStatus} />
                          <Chip size="small" label={o.deliveryStatus} color={o.deliveryStatus==='delivered' ? 'success':'default'} />
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </Box>
              )}
              <Box sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: "1.5rem",
                mb: 3
              }}>
                <Box flex="1 1 50%">
                  <Typography variant="subtitle2" color="#2d2d2d" fontWeight="600" gutterBottom>
                    Order Information
                  </Typography>
                  <Paper sx={{
                    padding: "1.2rem",
                    borderRadius: "12px",
                    bgcolor: "#f8f9fa",
                    border: "1px solid rgba(0,0,0,0.05)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    mb: 2
                  }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="body2" color="#666">
                        Order ID
                      </Typography>
                      <Typography variant="body2" fontWeight="600" color="#2d2d2d">
                        {orderDetails.orderId || orderId}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="body2" color="#666">
                        Status
                      </Typography>
                      <Chip
                        label={orderDetails.status || "In Transit"}
                        size="small"
                        sx={{
                          bgcolor: orderDetails.status === "Delivered" ? "#4caf50" : "#2d2d2d",
                          color: "white",
                        }}
                      />
                    </Box>


                    {orderDetails.trackUrl && (
                      <Button
                        fullWidth
                        variant="outlined"
                        size="small"
                        startIcon={<MapIcon />}
                        endIcon={<LaunchIcon fontSize="small" />}
                        onClick={() => window.open(orderDetails.trackUrl, "_blank")}
                        sx={{
                          mt: 1,
                          borderColor: "#2d2d2d",
                          color: "#2d2d2d",
                          textTransform: "none",
                          "&:hover": {
                            borderColor: "#2d2d2d",
                            backgroundColor: "rgba(45,45,45,0.04)"
                          }
                        }}
                      >
                        Open ShipRocket Tracking
                      </Button>
                    )}
                  </Paper>
                </Box>

                <Box flex="1 1 50%">
                  <Typography variant="subtitle2" color="#2d2d2d" fontWeight="600" gutterBottom>
                    Delivery Address
                  </Typography>
                  <Paper sx={{
                    padding: "1.2rem",
                    borderRadius: "12px",
                    bgcolor: "#f8f9fa",
                    border: "1px solid rgba(0,0,0,0.05)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    height: "calc(100% - 28px)"
                  }}>                    <Typography variant="body2" fontWeight="600" color="#2d2d2d" sx={{ mb: 0.5, lineHeight: 1.6 }}>
                      {orderDetails.name || "Customer Name"}
                    </Typography>
                    <Typography variant="body2" color="#666" sx={{ lineHeight: 1.6, mb: 1 }}>
                      {orderDetails.address || "Delivery address will be displayed here"}
                    </Typography>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      <Typography variant="body2" fontWeight="600" color="#2d2d2d">
                        Contact Information:
                      </Typography>
                      <Typography variant="body2" color="#666" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <span style={{ fontWeight: 600 }}>Phone:</span> {orderDetails.phoneNumber || "Not provided"}
                      </Typography>
                      {orderDetails.email && (
                        <Typography variant="body2" color="#666" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <span style={{ fontWeight: 600 }}>Email:</span> {orderDetails.email}
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                </Box>
              </Box>

              <Typography variant="subtitle2" color="#2d2d2d" fontWeight="600" gutterBottom>
                Tracking Journey
              </Typography>

              <Paper sx={{
                padding: "1.2rem",
                borderRadius: "12px",
                bgcolor: "#f8f9fa",
                border: "1px solid rgba(0,0,0,0.05)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                position: "relative",
                overflow: "hidden"
              }}>
                {/* Racing stripes background */}
                <Box sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.03,
                  zIndex: 0,
                  background: `repeating-linear-gradient(
                    45deg,
                    transparent,
                    transparent 10px,
                    #2d2d2d 10px,
                    #2d2d2d 20px
                  )`,
                }} />

                {orderDetails.trackingSteps ? (
                  <Box sx={{ display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
                    {orderDetails.trackingSteps.map((step, index) => (
                      <Box key={index} sx={{
                        display: "flex",
                        gap: "1rem",
                        position: "relative",
                        pb: index === orderDetails.trackingSteps.length - 1 ? 0 : 3,
                        "&::after": index === orderDetails.trackingSteps.length - 1 ? {} : {
                          content: '""',
                          position: "absolute",
                          left: "12px",
                          top: "24px",
                          bottom: 0,
                          width: "2px",
                          backgroundColor: "rgba(0,0,0,0.1)",
                        }
                      }}>
                        <Box sx={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          backgroundColor: step.completed ? "#2d2d2d" : "#e0e0e0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          boxShadow: step.completed ? "0 0 0 4px rgba(45,45,45,0.15)" : "none",
                          transition: "all 0.2s ease",
                        }}>
                          <Box sx={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: step.completed ? "white" : "#bdbdbd"
                          }} />
                        </Box>

                        <Box sx={{
                          backgroundColor: step.completed ? "rgba(45,45,45,0.03)" : "transparent",
                          padding: step.completed ? "0.5rem 1rem" : "0.5rem 0",
                          borderRadius: "8px",
                          flex: 1
                        }}>
                          <Typography variant="body2" fontWeight="600" color="#2d2d2d">
                            {step.label}
                          </Typography>
                          <Box sx={{ display: "flex", gap: 2, mt: 0.5, alignItems: "center" }}>
                            <Typography variant="body2" color="#666" fontSize="0.8rem">
                              {step.date || "Date pending"}
                            </Typography>
                            <Typography variant="body2" color="#666" fontSize="0.8rem">
                              {step.time || "Time pending"}
                            </Typography>
                          </Box>
                          {step.description && (
                            <Typography variant="body2" color="#666" sx={{ mt: 0.5 }}>
                              {step.description}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Box sx={{ textAlign: "center", py: 3, position: "relative", zIndex: 1 }}>
                    <Typography variant="body1" color="#666">
                      Tracking details will be available once the order is processed.
                    </Typography>
                    <Typography variant="body2" color="#999" sx={{ mt: 1 }}>
                      Check back soon for real-time updates.
                    </Typography>
                  </Box>
                )}
              </Paper>

              <Box sx={{ display: "flex", justifyContent: "center", mt: 3, gap: 2 }}>
                {orderDetails.trackUrl && (
                  <Button
                    variant="contained"
                    onClick={() => window.open(orderDetails.trackUrl, "_blank")}
                    sx={{
                      backgroundColor: "#2d2d2d",
                      color: "white",
                      "&:hover": {
                        backgroundColor: "#1a1a1a",
                      }
                    }}
                    startIcon={<LaunchIcon />}
                  >
                    View on ShipRocket
                  </Button>
                )}
                <Button
                  variant="outlined"
                  onClick={() => setShowDetailDialog(false)}
                  sx={{
                    borderColor: "#2d2d2d",
                    color: "#2d2d2d",
                    "&:hover": {
                      borderColor: "#2d2d2d",
                      backgroundColor: "rgba(45,45,45,0.04)"
                    }
                  }}
                >
                  Close
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Error and Success Messages */}
      <Snackbar open={!!error} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar open={!!success} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>
    </>
  );
}
