'use client';

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Drawer } from '@mui/material';
import { closeCartDrawer } from '@/store/slices/uiSlice';
import ViewCart from '@/components/full-page-comps/ViewCart';

const CartDrawer = () => {
  const dispatch = useDispatch();
  const isCartDrawerOpen = useSelector((state) => state.ui.isCartDrawerOpen);

  return (
    <Drawer
      anchor="bottom"
      open={isCartDrawerOpen}
      onClose={() => dispatch(closeCartDrawer())}
      sx={{
        '& .MuiDrawer-paper': {
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          boxShadow: 'none',
          padding: 0,
          margin: 0,
          border: 'none',
          overflowY: 'auto',
        },
        '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
        },
      }}
      transitionDuration={200} // Very fast transition
    >
      <ViewCart isDrawer={true} />
    </Drawer>
  );
};

export default CartDrawer;
