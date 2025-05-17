'use client';

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Drawer, Box } from '@mui/material';
import { closeCartDrawer } from '@/store/slices/uiSlice';
import ViewCart from '@/components/full-page-comps/ViewCart';
import { useSpring, animated } from '@react-spring/web';
import useHistoryState from '@/hooks/useHistoryState';

const CartDrawer = () => {
  const dispatch = useDispatch();
  const isCartDrawerOpen = useSelector((state) => state.ui.isCartDrawerOpen);
  const drawerSource = useSelector((state) => state.ui.cartDrawerSource);
  
  // Add history state management with lower priority than coupon dialog
  const handleClose = () => dispatch(closeCartDrawer());
  useHistoryState(isCartDrawerOpen, handleClose, 'cartDrawer', 5); // Lower priority number
  
  // Determine transition properties based on source
  const isTopSource = drawerSource === 'top';
  
  // Configure drawer props based on source
  const drawerProps = {
    anchor: isTopSource ? 'top' : 'bottom',
    transitionDuration: 250, // Fast but not jarring
    sx: {
      // Override shadow to remove any visual edge at the top/bottom
      '& .MuiDrawer-paper': {
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        boxShadow: 'none',
        padding: 0,
        margin: 0,
        border: 'none',
        overflowY: 'hidden', // Prevent drawer's default scrolling
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      },
      '& .MuiBackdrop-root': {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
      },
    }
  };

  // Create slide animation style
  const slideInProps = useSpring({
    from: { 
      transform: isTopSource 
        ? 'translateY(-100%)' 
        : 'translateY(100%)',
    },
    to: {
      transform: isCartDrawerOpen 
        ? 'translateY(0%)' 
        : isTopSource 
          ? 'translateY(-100%)' 
          : 'translateY(100%)',
    },
    config: { 
      tension: 280, 
      friction: 24,
      clamp: true, // Prevent overshooting for a cleaner animation
    },
  });
  
  return (
    <Drawer
      {...drawerProps}
      open={isCartDrawerOpen}
      onClose={handleClose}
      // Don't let Drawer handle its own back button
      disableEscapeKeyDown={true}
      SlideProps={{
        appear: true,
        direction: isTopSource ? 'down' : 'up',
        style: { 
          visibility: 'visible', 
          transform: 'none' 
        }
      }}
    >
      <animated.div 
        style={{
          ...slideInProps,
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden', // Ensure no content spills outside
        }}
      >
        <Box 
          sx={{ 
            width: '100%', 
            height: '100%', 
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <ViewCart isDrawer={true} />
        </Box>
      </animated.div>
    </Drawer>
  );
};

export default CartDrawer;
