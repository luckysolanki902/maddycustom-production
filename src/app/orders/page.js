"use client";
import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, Button, LinearProgress, Chip, Divider, Skeleton } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import Image from "next/image";
import LoginIcon from "@mui/icons-material/Login";

export default function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(false);

  const userDetails = useSelector(state => state.orderForm.userDetails);

  useEffect(() => {
    if (!userDetails?.userId) {
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/order/user?userId=${userDetails.userId}`);
        const data = await res.json();

        if (res.ok) {
          setOrders(data.orders);
        } else {
          console.error(data.message);
          setOrders([]);
        }
      } catch (error) {
        console.error("Error fetching orders:", error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [userDetails.userId]);

  const handleTrackOrder = async orderId => {
    try {
      setTrackingLoading(true);
      const response = await fetch(`/api/order/track?orderId=${orderId}`);

      if (response.redirected) {
        window.location.href = response.url;
      } else {
        const data = await response.json();
        alert(data.message);
      }
    } catch (error) {
      console.error("Error tracking order:", error);
      alert("Error tracking order");
    } finally {
      setTrackingLoading(false);
    }
  };

  const getProgressValue = status => {
    switch (status) {
      case "pending":
        return 10;
      case "processing":
        return 30;
      case "shipped":
        return 70;
      case "onTheWay":
        return 85;
      case "delivered":
        return 100;
      default:
        return 0;
    }
  };

  if (userDetails?.userId) {
    return (
      <Box
        sx={{
          textAlign: "center",
          mt: 10,
          px: 3,
          py: 5,
          maxWidth: 400,
          mx: "auto",
          bgcolor: "#ffffff",
          borderRadius: 3,
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
          mb: "10rem"
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            mx: "auto",
            mb: 2,
            bgcolor: "#e3f2fd",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LoginIcon sx={{ color: "#1976d2", fontSize: 32 }} />
        </Box>

        <Typography variant="h5" fontWeight={600} gutterBottom>
          You’re not logged in
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Please log in to view and track your orders seamlessly.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          href="/login" // Replace with your actual login URL
          sx={{
            textTransform: "none",
            px: 4,
            py: 1.5,
            borderRadius: 2,
            fontWeight: 600,
            fontSize: "1rem",
            boxShadow: "0 4px 12px rgba(25, 118, 210, 0.4)",
            "&:hover": {
              boxShadow: "0 6px 20px rgba(25, 118, 210, 0.5)",
            },
          }}
        >
          Login Now
        </Button>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 4 }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} variant="rectangular" height={180} sx={{ borderRadius: 2, mb: 3 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "#f5f7fa", minHeight: "100vh", p: { xs: 2, md: 4 } }}>
      {orders.length === 0 ? (
        <Typography variant="h6" textAlign="center" mt={5}>
          No orders found.
        </Typography>
      ) : (
        orders.map(order => {
          const progress = getProgressValue(order.deliveryStatus);

          return (
            <Card
              key={order._id}
              sx={{
                mb: 4,
                borderRadius: 3,
                boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                overflow: "hidden",
                transition: "transform 0.2s",
                "&:hover": { transform: "translateY(-4px)" },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box>
                  {order.items.map((item, idx) => (
                    <Box key={idx} sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                      <Image
                        src={`${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}${
                          item.thumbnail || "/products/wraps/car-wraps/window-pillar-wraps/win/win49.jpg"
                        }`}
                        alt={item.name}
                        width={80}
                        height={80}
                        style={{
                          borderRadius: "8px",
                          objectFit: "cover",
                          marginRight: "12px",
                        }}
                      />
                      <Box>
                        <Typography variant="subtitle1" fontWeight={600}>
                          {item.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.wrapFinish || ""} • Qty: {item.quantity}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ₹{item.priceAtPurchase}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>

                <Typography variant="body2" color="text.secondary" mt={1}>
                  Order ID: {order._id}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Placed on: {new Date(order.createdAt).toLocaleDateString()}
                </Typography>

                <Chip
                  label={order.deliveryStatus.toUpperCase()}
                  color={
                    order.deliveryStatus === "delivered"
                      ? "success"
                      : order.deliveryStatus === "shipped"
                      ? "primary"
                      : order.deliveryStatus === "cancelled"
                      ? "error"
                      : "warning"
                  }
                  size="small"
                  sx={{ mt: 1 }}
                />

                <Typography variant="body2" mt={1}>
                  ₹{order.totalAmount}
                </Typography>

                <Typography variant="body2">
                  Deliver to: {order.address.receiverName}, {order.address.city}, {order.address.state}
                </Typography>

                <Box sx={{ mt: 3 }}>
                  <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5 }} />
                </Box>

                <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => handleTrackOrder(order._id)}
                    disabled={trackingLoading}
                    sx={{
                      textTransform: "none",
                      borderColor: "#424242",
                      color: "#424242",
                      px: 3,
                      py: 1,
                      borderRadius: 2,
                      fontWeight: 500,
                      letterSpacing: 0.5,
                      transition: "all 0.3s ease",
                      "&:hover": {
                        bgcolor: "#f5f5f5",
                        borderColor: "#212121",
                        color: "#212121",
                        transform: "translateY(-2px)",
                      },
                    }}
                    startIcon={trackingLoading ? null : <span style={{ fontSize: "1.2em", display: "inline-block" }}>🚚</span>}
                  >
                    {trackingLoading ? "Tracking..." : "Track"}
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={() => setExpandedOrderId(prev => (prev === order._id ? null : order._id))}
                    sx={{ textTransform: "none" }}
                  >
                    {expandedOrderId === order._id ? "Hide Details" : "View Steps"}
                  </Button>
                </Box>
              </CardContent>
              <AnimatePresence>
                {expandedOrderId === order._id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    <Divider sx={{ my: 2 }} />

                    <Box
                      sx={{
                        position: "relative",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        px: 2,
                        pb: 2,
                      }}
                    >
                      {/* Progress background line */}
                      <Box
                        sx={{
                          position: "absolute",
                          top: 14,
                          left: 0,
                          right: 0,
                          height: 4,
                          bgcolor: "#e0e0e0",
                          borderRadius: 2,
                        }}
                      />

                      {/* Progress foreground line */}
                      <Box
                        sx={{
                          position: "absolute",
                          top: 14,
                          left: 0,
                          height: 4,
                          bgcolor: order.deliveryStatus === "cancelled" ? "#f44336" : "#4caf50",
                          borderRadius: 2,
                          width: `${order.deliveryStatus === "cancelled" ? 30 : getProgressValue(order.deliveryStatus)}%`,
                          transition: "width 0.4s ease",
                        }}
                      />

                      {["Order Placed", "Packed", "Shipped", "Out for Delivery", "Delivered"].map((step, index) => {
                        const stepPercent = (index / (5 - 1)) * 100;
                        const stepCompleted = getProgressValue(order.deliveryStatus) >= stepPercent;

                        // For cancelled orders, only first 1-2 steps are completed
                        const isCancelled = order.deliveryStatus === "cancelled";
                        const showAsCompleted = isCancelled ? index <= 1 : stepCompleted;

                        return (
                          <Box
                            key={index}
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              zIndex: 1,
                            }}
                          >
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                bgcolor:
                                  isCancelled && !showAsCompleted
                                    ? "#e0e0e0"
                                    : showAsCompleted
                                    ? isCancelled
                                      ? "#f44336"
                                      : "#4caf50"
                                    : "#e0e0e0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontWeight: "bold",
                                transition: "all 0.4s ease",
                              }}
                            >
                              {showAsCompleted ? "✓" : index + 1}
                            </Box>
                            <Typography
                              variant="caption"
                              sx={{
                                mt: 0.5,
                                textAlign: "center",
                                maxWidth: 70,
                                minHeight: 32,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: showAsCompleted ? (isCancelled ? "#f44336" : "#4caf50") : "gray",
                              }}
                            >
                              {step}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })
      )}
    </Box>
  );
}
