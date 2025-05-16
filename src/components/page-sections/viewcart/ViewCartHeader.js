// components/page-sections/viewcart/ViewCartHeader.js

'use client';

import React from 'react';
import { IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import styles from './styles/viewcart.module.css';
import { useDispatch } from 'react-redux';
import { closeCartDrawer } from '@/store/slices/uiSlice';

const ViewCartHeader = ({ totalQuantity, onBack }) => {
  const dispatch = useDispatch();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      dispatch(closeCartDrawer());
    }
  };

  return (
    <div className={styles.header}>
      <IconButton onClick={handleBack}>
        <ArrowBackIcon sx={{ color: 'black' }} />
      </IconButton>
      <h1 className={styles.heading}>
        My Cart <span>({totalQuantity})</span>
      </h1>
    </div>
  );
};

export default ViewCartHeader;
