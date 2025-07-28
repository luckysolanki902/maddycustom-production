"use client";
import React, { useEffect, useState } from "react";
import { Box, Typography, Button, LinearProgress, Dialog, IconButton, useMediaQuery, useTheme, 
  Card, CardContent, Chip, Skeleton, CircularProgress, Divider } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import Image from "next/image";
import MobileAuth from "@/components/auth/MobileAuth";
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';

// Modern status components with animations
const OrderStatusIcon = ({ type, isActive, isCompleted }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const icons = {
    placed: InventoryOutlinedIcon,
    shipped: LocalShippingOutlinedIcon,
    transit: LocationOnOutlinedIcon,
    delivered: CheckCircleOutlineOutlinedIcon
  };

  const Icon = icons[type];
  
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: isMobile ? 40 : 48,
        height: isMobile ? 40 : 48,
        borderRadius: '50%',
        backgroundColor: isCompleted ? 'primary.main' : isActive ? 'primary.lighter' : '#f5f5f5',
        transition: 'all 0.3s ease',
      }}
    >
      <Icon sx={{ 
        fontSize: isMobile ? 20 : 24,
        color: isCompleted ? 'white' : isActive ? 'primary.main' : '#999',
        transition: 'all 0.3s ease'
      }} />
      {isActive && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: '2px solid',
            borderColor: 'primary.main',
          }}
        />
      )}
    </Box>
  );
};

// Order card component with smooth animations
const OrderCard = ({ order, onClick }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'delivered': return '#4CAF50';
      case 'shipped': return '#2196F3';
      case 'processing': return '#FF9800';
      default: return '#757575';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        onClick={onClick}
        sx={{
          cursor: 'pointer',
          mb: 2,
          borderRadius: '16px',
          background: '#fff',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          position: 'relative',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          },
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  fontWeight: 600,
                  color: '#1a1a1a',
                  mb: 0.5,
                  fontFamily: 'Jost, sans-serif',
                }}
              >
                Order #{order.orderId}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#666',
                  fontFamily: 'Jost, sans-serif',
                }}
              >
                {new Date(order.orderDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Typography>
            </Box>
            <Chip
              label={order.status}
              sx={{
                bgcolor: `${getStatusColor(order.status)}15`,
                color: getStatusColor(order.status),
                fontWeight: 600,
                borderRadius: '8px',
                '& .MuiChip-label': {
                  px: 2,
                  fontFamily: 'Jost, sans-serif',
                }
              }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box 
              sx={{ 
                width: isMobile ? 80 : 100, 
                height: isMobile ? 80 : 100,
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative',
                bgcolor: '#f5f5f5'
              }}
            >
              <Image
                src={order.productImage}
                alt={order.productName}
                fill
                style={{ objectFit: 'cover' }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 600,
                  color: '#1a1a1a',
                  mb: 1,
                  fontSize: isMobile ? '1rem' : '1.1rem',
                  fontFamily: 'Jost, sans-serif',
                }}
              >
                {order.productName}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: '#666',
                  fontFamily: 'Jost, sans-serif',
                }}
              >
                {order.description}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography 
              variant="h6" 
              sx={{ 
                fontWeight: 600,
                color: '#1a1a1a',
                fontFamily: 'Jost, sans-serif',
              }}
            >
              ₹{order.amount.toLocaleString()}
            </Typography>
            <Button
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontFamily: 'Jost, sans-serif',
                fontWeight: 500,
                borderColor: '#000',
                color: '#000',
                '&:hover': {
                  borderColor: '#000',
                  backgroundColor: 'rgba(0,0,0,0.04)',
                }
              }}
            >
              Track Order
            </Button>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Tracking timeline component
const TrackingTimeline = ({ currentStatus }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const statuses = [
    { type: 'placed', label: 'Order Placed' },
    { type: 'shipped', label: 'Shipped' },
    { type: 'transit', label: 'In Transit' },
    { type: 'delivered', label: 'Delivered' }
  ];

  const currentIndex = statuses.findIndex(status => status.type === currentStatus);

  return (
    <Box 
      sx={{ 
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: 2,
        py: 2,
      }}
    >
      {statuses.map((status, index) => {
        const isCompleted = index <= currentIndex;
        const isActive = index === currentIndex;
        
        return (
          <Box
            key={status.type}
            sx={{
              display: 'flex',
              flexDirection: isMobile ? 'row' : 'column',
              alignItems: 'center',
              gap: isMobile ? 2 : 1,
              flex: 1,
              position: 'relative',
            }}
          >
            <OrderStatusIcon
              type={status.type}
              isActive={isActive}
              isCompleted={isCompleted}
            />
            <Typography
              sx={{
                color: isActive ? 'primary.main' : isCompleted ? '#000' : '#999',
                fontWeight: isActive ? 600 : 500,
                fontSize: isMobile ? '0.9rem' : '1rem',
                fontFamily: 'Jost, sans-serif',
                textAlign: isMobile ? 'left' : 'center',
              }}
            >
              {status.label}
            </Typography>
            {!isMobile && index < statuses.length - 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  top: '24px',
                  left: '100%',
                  width: '100%',
                  height: '2px',
                  bgcolor: isCompleted ? 'primary.main' : '#f0f0f0',
                  transform: 'translateX(-50%)',
                  transition: 'all 0.3s ease',
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
};

export default function MyGaragePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [trackingInfo, setTrackingInfo] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  const userDetails = useSelector(state => state.orderForm.userDetails);
  const isAuthenticated = !!userDetails?.userId;

  const fetchOrders = React.useCallback(async () => {
    if (!isAuthenticated || !userDetails?.userId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/user/my-garage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userDetails.userId
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      
      const data = await response.json();
      if (data && Array.isArray(data.orders)) {
        setOrders(data.orders);
      } else {
        console.error('Invalid data format received:', data);
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, userDetails?.userId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  if (!isAuthenticated) {
    return (
      <Box 
        sx={{ 
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          bgcolor: '#f8f9fa'
        }}
      >
        <MobileAuth />
      </Box>
    );
  }

  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: '#f8f9fa',
      py: { xs: 2, md: 4 },
      px: { xs: 2, md: 4 }
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Box sx={{ 
          maxWidth: 'lg',
          mx: 'auto',
          mb: { xs: 3, md: 4 }
        }}>
          <Box sx={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3 
          }}>
            <Typography 
              variant="h4" 
              sx={{ 
                fontWeight: 600,
                color: '#1a1a1a',
                fontSize: isMobile ? '1.5rem' : '2rem',
                fontFamily: 'Jost, sans-serif',
              }}
            >
              My Garage
            </Typography>
          </Box>

          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" height={150} sx={{ borderRadius: '16px', mb: 3 }} />
              ))}
            </>
          ) : orders.length > 0 ? (
            <AnimatePresence>
              {orders.map((order) => (
                <OrderCard
                  key={order.orderId}
                  order={order}
                  onClick={() => setSelectedOrder(order)}
                />
              ))}
            </AnimatePresence>
          ) : (
            <Box 
              sx={{ 
                textAlign: 'center',
                py: 8,
                px: 2,
                bgcolor: '#fff',
                borderRadius: '16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
              }}
            >
              <Typography 
                variant="h6" 
                sx={{ 
                  mb: 2,
                  color: '#666',
                  fontFamily: 'Jost, sans-serif',
                }}
              >
                No orders found
              </Typography>
              <Button
                variant="contained"
                sx={{
                  textTransform: 'none',
                  borderRadius: '8px',
                  fontFamily: 'Jost, sans-serif',
                  fontWeight: 500,
                  px: 4,
                  py: 1.5,
                  bgcolor: '#000',
                  '&:hover': {
                    bgcolor: '#333',
                  }
                }}
                onClick={() => window.location.href = '/shop'}
              >
                Start Shopping
              </Button>
            </Box>
          )}
        </Box>
      </motion.div>

      {/* Order Tracking Dialog */}
      <Dialog
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: isMobile ? 0 : '16px',
            m: isMobile ? 0 : 2,
          }
        }}
      >
        {selectedOrder && (
          <Box sx={{ position: 'relative', p: { xs: 2, md: 3 } }}>
            <IconButton
              onClick={() => setSelectedOrder(null)}
              sx={{ 
                position: 'absolute',
                right: 8,
                top: 8,
                color: '#666'
              }}
            >
              <CloseIcon />
            </IconButton>

            <Typography 
              variant="h6" 
              sx={{ 
                mb: 3,
                fontWeight: 600,
                color: '#1a1a1a',
                fontFamily: 'Jost, sans-serif',
              }}
            >
              Track Order #{selectedOrder.orderId}
            </Typography>

            <TrackingTimeline currentStatus={selectedOrder.status.toLowerCase()} />

            {trackingLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : trackingInfo ? (
              <Box sx={{ mt: 3 }}>
                {/* Add detailed tracking information here */}
              </Box>
            ) : null}
          </Box>
        )}
      </Dialog>
    </Box>
  );



  const handleTrackOrder = async (order) => {
    setSelectedOrder(order);
    setTrackingInfo(null);
    setTrackingLoading(true);
    
    try {
      const res = await fetch(`/api/orders/track-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: order.orderId,
          userId: userDetails.userId
        })
      });

      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}`);
      }

      const data = await res.json();
      if (data && data.tracking) {
        setTrackingInfo(data.tracking);
      } else {
        throw new Error('Invalid tracking data received');
      }
    } catch (error) {
      console.error("Error fetching tracking info:", error);
      setTrackingInfo(null);
    } finally {
      setTrackingLoading(false);
    }
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
          <MobileAuth />
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <OrderCard
                order={order}
                onClick={() => handleTrackOrder(order)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      <Dialog
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        maxWidth="sm"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius: '16px',
            bgcolor: '#fff',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
          }
        }}
      >
        {selectedOrder && (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <IconButton
              onClick={() => setSelectedOrder(null)}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8
              }}
            >
              <CloseIcon />
            </IconButton>

            <Typography 
              variant="h6" 
              sx={{ 
                mb: 3,
                fontWeight: 600,
                fontFamily: 'Jost, sans-serif'
              }}
            >
              Order Status
            </Typography>

            <TrackingTimeline currentStatus={selectedOrder.status.toLowerCase()} />

            {trackingLoading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : trackingInfo ? (
              <Box sx={{ mt: 4 }}>
                <Typography 
                  variant="body1"
                  sx={{ 
                    fontFamily: 'Jost, sans-serif',
                    color: '#1a1a1a'
                  }}
                >
                  Estimated Delivery: {trackingInfo.estimatedDelivery}
                </Typography>
              </Box>
            ) : null}
          </Box>
        )}
      </Dialog>
    </Box>
  );
};
