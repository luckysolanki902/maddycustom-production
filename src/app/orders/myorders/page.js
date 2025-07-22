"use client";
import React, { useEffect, useState } from "react";
import { Box, Card, CardContent, Typography, Button, LinearProgress, Chip, Divider, Skeleton, Dialog, IconButton, CircularProgress } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import Image from "next/image";
import MobileAuth from "@/components/auth/MobileAuth";
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// F1-inspired icons (placeholders, replace with actual icons if you have them)
const OrderPlacedIcon = () => <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>;
const ShippedIcon = () => <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h3.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"></path></svg>;
const InTransitIcon = () => <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path></svg>;
const DeliveredIcon = () => <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>;

export default function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const userDetails = useSelector(state => state.orderForm.userDetails);
  const isAuthenticated = !!userDetails?.userId;

  useEffect(() => {
    if (!isAuthenticated) {
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
  }, [isAuthenticated, userDetails.userId]);

  const handleTrackOrder = async (order) => {
    setSelectedOrder(order);
    if (order.deliveryStatus !== 'pending') {
      setTrackingLoading(true);
      try {
        // This is a placeholder for your actual Shiprocket API call
        // You would fetch the real tracking data here
        const res = await fetch(`/api/order/track?orderId=${order._id}`);
        if (res.ok) {
          const data = await res.json();
          setTrackingInfo(data);
        } else {
          // Fallback for demo purposes
          setTrackingInfo({
            estimatedDelivery: "3-5 business days",
            updates: [
              { status: "Order Placed", timestamp: order.createdAt },
              { status: "Shipped", timestamp: new Date(new Date(order.createdAt).getTime() + 2 * 24 * 60 * 60 * 1000).toISOString() },
            ]
          });
        }
      } catch (error) {
        console.error("Error fetching tracking info:", error);
        setTrackingInfo(null);
      } finally {
        setTrackingLoading(false);
      }
    }
  };

  const handleCloseDialog = () => {
    setSelectedOrder(null);
    setTrackingInfo(null);
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h4" sx={{ fontFamily: 'Jost, sans-serif', fontWeight: 700, mb: 4 }}>My Garage</Typography>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={150} sx={{ borderRadius: '16px', mb: 3 }} />
        ))}
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <Box sx={{ maxWidth: 400, width: '100%', p: 3 }}>
          <MobileAuth 
            title="Access Your Garage"
            subtitle="Log in to see your orders and track their status."
            onSuccess={() => { /* The page will re-render automatically */ }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "#fff", minHeight: "100vh", p: { xs: 2, md: 4 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ fontFamily: 'Jost, sans-serif', fontWeight: 700, mb: 4 }}>My Garage</Typography>
      
      {orders.length === 0 ? (
        <Typography variant="h6" textAlign="center" mt={5} sx={{ fontFamily: 'Jost, sans-serif', color: '#777' }}>
          Your garage is empty. Time to customize!
        </Typography>
      ) : (
        <AnimatePresence>
          {orders.map((order, index) => (
            <motion.div
              key={order._id}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <OrderCard order={order} onTrack={() => handleTrackOrder(order)} />
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {selectedOrder && (
        <TrackingDialog 
          open={!!selectedOrder} 
          onClose={handleCloseDialog} 
          order={selectedOrder}
          trackingInfo={trackingInfo}
          loading={trackingLoading}
        />
      )}
    </Box>
  );
}

const OrderCard = ({ order, onTrack }) => {
  const getStatusChip = (status) => {
    const styles = {
      pending: { bgcolor: '#f5f5f5', color: '#616161' },
      processing: { bgcolor: '#e3f2fd', color: '#1e88e5' },
      shipped: { bgcolor: '#e0f7fa', color: '#00838f' },
      onTheWay: { bgcolor: '#e8f5e9', color: '#388e3c' },
      delivered: { bgcolor: '#dcedc8', color: '#558b2f' },
      cancelled: { bgcolor: '#ffebee', color: '#c62828' },
    };
    return styles[status] || styles.pending;
  };

  return (
    <Card
      sx={{
        mb: 3,
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        border: '1px solid #e0e0e0',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 12px 28px rgba(0,0,0,0.1)',
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#757575' }}>
              Order #{order._id.slice(-6)}
            </Typography>
            <Typography variant="h6" sx={{ fontFamily: 'Jost, sans-serif', fontWeight: 600 }}>
              Total: ₹{order.totalAmount.toFixed(2)}
            </Typography>
            <Typography variant="body2" sx={{ color: '#616161' }}>
              {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
          </Box>
          <Chip
            label={order.deliveryStatus.replace(/([A-Z])/g, ' $1').trim()}
            size="small"
            sx={{
              ...getStatusChip(order.deliveryStatus),
              fontFamily: 'Jost, sans-serif',
              fontWeight: 600,
              textTransform: 'capitalize',
              borderRadius: '8px',
              px: 1,
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, mb: 2 }}>
          {order.items.map((item, idx) => (
            <Box key={idx} sx={{ position: 'relative', flexShrink: 0 }}>
              <Image
                src={item.thumbnail || `${process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL}/products/wraps/car-wraps/window-pillar-wraps/win/win49.jpg`}
                alt={item.name}
                width={64}
                height={64}
                style={{ borderRadius: '12px', objectFit: 'cover' }}
              />
              {item.quantity > 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    bgcolor: '#212121',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '2px solid #fff',
                  }}
                >
                  {item.quantity}
                </Box>
              )}
            </Box>
          ))}
        </Box>

        <Button
          variant="contained"
          onClick={onTrack}
          sx={{
            width: '100%',
            mt: 1,
            py: 1.5,
            fontFamily: 'Jost, sans-serif',
            fontWeight: 600,
            fontSize: '1rem',
            borderRadius: '12px',
            bgcolor: '#212121',
            color: '#fff',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: '#000',
              transform: 'translateY(-2px)',
            },
          }}
        >
          Track Order
        </Button>
      </CardContent>
    </Card>
  );
};

const TrackingDialog = ({ open, onClose, order, trackingInfo, loading }) => {
  const steps = [
    { label: 'Order Placed', icon: <OrderPlacedIcon /> },
    { label: 'Shipped', icon: <ShippedIcon /> },
    { label: 'In Transit', icon: <InTransitIcon /> },
    { label: 'Delivered', icon: <DeliveredIcon /> },
  ];

  const getActiveStep = () => {
    switch (order.deliveryStatus) {
      case 'pending':
      case 'processing':
        return 0;
      case 'shipped':
        return 1;
      case 'onTheWay':
        return 2;
      case 'delivered':
        return 3;
      default:
        return -1;
    }
  };
  const activeStep = getActiveStep();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: '24px',
          bgcolor: '#f5f7fa',
          boxShadow: '0 16px 40px rgba(0,0,0,0.15)',
        },
      }}
    >
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <IconButton onClick={onClose} sx={{ position: 'absolute', top: 16, right: 16 }}>
          <CloseIcon />
        </IconButton>

        <Typography variant="h5" sx={{ fontFamily: 'Jost, sans-serif', fontWeight: 700, mb: 1 }}>
          Tracking Details
        </Typography>
        <Typography variant="body2" sx={{ color: '#757575', mb: 4 }}>
          Order #{order._id}
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', mb: 1 }}>
                {steps.map((step, index) => (
                  <Box key={step.label} sx={{ zIndex: 1, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        bgcolor: index <= activeStep ? '#212121' : '#e0e0e0',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.4s ease',
                      }}
                    >
                      {step.icon}
                    </Box>
                    <Typography variant="caption" sx={{ mt: 1, display: 'block', color: index <= activeStep ? '#212121' : '#757575', fontWeight: index <= activeStep ? 600 : 400 }}>
                      {step.label}
                    </Typography>
                  </Box>
                ))}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 20,
                    left: '12.5%',
                    right: '12.5%',
                    height: '2px',
                    bgcolor: '#e0e0e0',
                    zIndex: 0,
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${(activeStep / (steps.length - 1)) * 100}%`,
                      bgcolor: '#212121',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ fontFamily: 'Jost, sans-serif', fontWeight: 600, mb: 1 }}>
                  Shipping Address
                </Typography>
                <Typography>{order.address.receiverName}</Typography>
                <Typography>{order.address.addressLine1}</Typography>
                {order.address.addressLine2 && <Typography>{order.address.addressLine2}</Typography>}
                <Typography>{order.address.city}, {order.address.state} {order.address.pincode}</Typography>
                <Typography>Phone: {order.address.receiverPhoneNumber}</Typography>
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontFamily: 'Jost, sans-serif', fontWeight: 600, mb: 1 }}>
                  Estimated Delivery
                </Typography>
                <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#388e3c' }}>
                  {trackingInfo?.estimatedDelivery || 'Not available'}
                </Typography>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Dialog>
  );
};
